package com.sakiai.backend.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.exception.AiServiceException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SakiAiServiceFallbackTest {

    private static final String ANSWER = """
            {"candidates":[{"content":{"parts":[{"text":"{\\"userTranscript\\":\\"q\\",\\"detectedLanguage\\":\\"en-US\\",\\"spokenResponse\\":\\"The code is in the editor.\\",\\"codePayload\\":{\\"hasCode\\":false,\\"programmingLanguage\\":\\"plaintext\\",\\"fileName\\":\\"\\",\\"code\\":\\"\\",\\"explanationMarkdown\\":\\"\\"}}"}]}}]}""";
    private static final String BUSY = "{\"error\":{\"code\":503,\"message\":\"This model is currently experiencing high demand.\"}}";
    private static final String BAD_KEY = "{\"error\":{\"code\":403,\"message\":\"API key not valid\"}}";

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<String> calledModels = new CopyOnWriteArrayList<>();
    private HttpServer server;

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void busyMainModelFallsBackToNextModel() throws IOException {
        start(Map.of("main", new Reply(503, BUSY), "backup", new Reply(200, ANSWER)));

        AiReply reply = service(List.of("backup")).ask(query());

        assertThat(reply.spokenResponse()).isEqualTo("The code is in the editor.");
        assertThat(calledModels).containsExactly("main", "backup");
    }

    @Test
    void retiredMainModelFallsBack() throws IOException {
        start(Map.of("main", new Reply(404, "{\"error\":{\"message\":\"no longer available\"}}"),
                "backup", new Reply(200, ANSWER)));

        assertThat(service(List.of("backup")).ask(query()).detectedLanguage()).isEqualTo("en-US");
    }

    @Test
    void authErrorDoesNotTryOtherModels() throws IOException {
        start(Map.of("main", new Reply(403, BAD_KEY), "backup", new Reply(200, ANSWER)));

        assertThatThrownBy(() -> service(List.of("backup")).ask(query()))
                .isInstanceOf(AiServiceException.class)
                .extracting(e -> ((AiServiceException) e).getErrorCode()).isEqualTo("AI_AUTH_FAILED");
        assertThat(calledModels).containsExactly("main");
    }

    @Test
    void exhaustedQuotaTriesOtherModelsThenExplainsTheQuota() throws IOException {
        String quota = "{\"error\":{\"code\":429,\"message\":\"You exceeded your current quota, please check your plan and billing details.\"}}";
        start(Map.of("main", new Reply(429, quota), "backup", new Reply(429, quota)));

        assertThatThrownBy(() -> service(List.of("backup")).ask(query()))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("quota")
                .extracting(e -> ((AiServiceException) e).getErrorCode()).isEqualTo("AI_QUOTA_EXCEEDED");
        assertThat(calledModels).containsExactly("main", "backup");
    }

    @Test
    void invalidApiKeyIsReportedAsAuthFailureWithoutTryingOtherModels() throws IOException {
        String invalid = "{\"error\":{\"code\":400,\"message\":\"API key not valid. Please pass a valid API key.\"}}";
        start(Map.of("main", new Reply(400, invalid), "backup", new Reply(200, ANSWER)));

        assertThatThrownBy(() -> service(List.of("backup")).ask(query()))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("GEMINI_API_KEY")
                .extracting(e -> ((AiServiceException) e).getErrorCode()).isEqualTo("AI_AUTH_FAILED");
        assertThat(calledModels).containsExactly("main");
    }

    @Test
    void allModelsBusyGivesFriendlyError() throws IOException {
        start(Map.of("main", new Reply(503, BUSY), "backup", new Reply(503, BUSY)));

        assertThatThrownBy(() -> service(List.of("backup")).ask(query()))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("busy right now");
        assertThat(calledModels).containsExactly("main", "backup");
    }

    private record Reply(int status, String body) {
    }

    private void start(Map<String, Reply> byModel) throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/v1beta/models/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String model = path.substring(path.lastIndexOf('/') + 1, path.indexOf(':', path.lastIndexOf('/')));
            calledModels.add(model);
            Reply reply = byModel.get(model);
            byte[] bytes = reply.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(reply.status(), bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }

    private SakiAiService service(List<String> fallbacks) {
        String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/v1beta";
        // maxRetries = 0 keeps the test fast: one call per model.
        SakiProperties.Gemini gemini = new SakiProperties.Gemini("test-key", "main", fallbacks, baseUrl, 0.4, 1024,
                null, Duration.ofSeconds(5), 0);
        SakiProperties properties = new SakiProperties(null, null, new SakiProperties.Ai(gemini, 10, 60000), null, null);
        return new SakiAiService(RestClient.builder().baseUrl(baseUrl).build(), mapper,
                new GeminiResponseParser(mapper), properties);
    }

    private static AiQuery query() {
        return new AiQuery("Untitled", "java", "", "en-US", List.of(), null, "How do I sort a list?");
    }
}
