package com.sakiai.backend.service.tts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.config.SakiProperties;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiTtsServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<JsonNode> lastRequest = new AtomicReference<>();
    private HttpServer server;

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void sinhalaWavResponseIsReEncodedToMp3WithSinhalaVoice() throws IOException {
        GeminiTtsService service = serviceReturning("audio/wav", wav(pcmTone(24_000, 1.0), 24_000));

        byte[] mp3 = service.synthesize("හරි යාළුවා! Code එක editor එකේ බලන්න.", "si-LK");

        assertMp3(mp3);
        JsonNode request = lastRequest.get();
        assertThat(request.at("/generationConfig/responseModalities/0").asText()).isEqualTo("AUDIO");
        assertThat(request.at("/generationConfig/speechConfig/voiceConfig/prebuiltVoiceConfig/voiceName").asText())
                .isEqualTo("SinhalaVoice");
        // Exactly the text to speak: any instruction would be read aloud too.
        assertThat(request.at("/contents/0/parts/0/text").asText())
                .isEqualTo("හරි යාළුවා! Code එක editor එකේ බලන්න.");
    }

    @Test
    void englishRawPcmResponseUsesRateFromMimeType() throws IOException {
        GeminiTtsService service = serviceReturning("audio/L16;codec=pcm;rate=16000", pcmTone(16_000, 0.5));

        byte[] mp3 = service.synthesize("Check your editor.", "en-US");

        assertMp3(mp3);
        assertThat(lastRequest.get().at("/generationConfig/speechConfig/voiceConfig/prebuiltVoiceConfig/voiceName")
                .asText()).isEqualTo("EnglishVoice");
    }

    @Test
    void responseWithoutAudioIsATtsFailure() throws IOException {
        start("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"no audio\"}]}}]}", 200);

        assertThatThrownBy(() -> service().synthesize("hello", "en-US"))
                .isInstanceOf(TtsException.class)
                .hasMessageContaining("no audio");
    }

    @Test
    void upstreamErrorIsATtsFailureSoTheChainFallsBack() throws IOException {
        start("{\"error\":{\"code\":404,\"message\":\"model not found\"}}", 404);

        assertThatThrownBy(() -> service().synthesize("hello", "en-US"))
                .isInstanceOf(TtsException.class)
                .hasMessageContaining("404");
    }

    @Test
    void mainModelOutOfQuotaFallsBackToTheNextVoiceModel() throws IOException {
        start("{\"error\":{\"code\":429,\"message\":\"quota exceeded\"}}", 429);
        String audio = Base64.getEncoder().encodeToString(wav(pcmTone(24_000, 0.5), 24_000));
        byte[] ok = ("{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"audio/wav\",\"data\":\""
                + audio + "\"}}]}}]}").getBytes(StandardCharsets.UTF_8);
        server.createContext("/v1beta/models/backup-tts:generateContent", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, ok.length);
            exchange.getResponseBody().write(ok);
            exchange.close();
        });

        assertMp3(service().synthesize("hello", "en-US"));
    }

    @Test
    void notConfiguredWithoutApiKey() {
        GeminiTtsService service = new GeminiTtsService(RestClient.create(), mapper, properties("", "http://unused"));
        assertThat(service.supports("si-LK")).isFalse();
    }

    // ---------------------------------------------------------------- helpers

    private GeminiTtsService serviceReturning(String mimeType, byte[] audio) throws IOException {
        String body = "{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"" + mimeType
                + "\",\"data\":\"" + Base64.getEncoder().encodeToString(audio) + "\"}}]}}]}";
        start(body, 200);
        return service();
    }

    private GeminiTtsService service() {
        String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/v1beta";
        GeminiTtsService service = new GeminiTtsService(RestClient.create(), mapper, properties("test-key", baseUrl));
        assertThat(service.supports("en-US")).isTrue();
        return service;
    }

    private void start(String responseBody, int status) throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/v1beta/models/test-tts:generateContent", exchange -> {
            assertThat(exchange.getRequestHeaders().getFirst("x-goog-api-key")).isEqualTo("test-key");
            lastRequest.set(mapper.readTree(exchange.getRequestBody()));
            byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }

    private static SakiProperties properties(String apiKey, String baseUrl) {
        SakiProperties.Gemini gemini = new SakiProperties.Gemini("unused", "gemini-test", List.of(), baseUrl, 0.4, 1024,
                0, Duration.ofSeconds(5), 0);
        SakiProperties.Tts tts = new SakiProperties.Tts(List.of("gemini"), 1500, Duration.ofSeconds(5), false,
                new SakiProperties.GeminiTts(apiKey, "test-tts", List.of("backup-tts"), "SinhalaVoice", "EnglishVoice", 64),
                null, null);
        return new SakiProperties(null, null, new SakiProperties.Ai(gemini, 10, 60000), tts, null);
    }

    private static byte[] pcmTone(int sampleRate, double seconds) {
        int samples = (int) (sampleRate * seconds);
        ByteBuffer pcm = ByteBuffer.allocate(samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < samples; i++) {
            pcm.putShort((short) (Math.sin(2 * Math.PI * 440 * i / sampleRate) * 8000));
        }
        return pcm.array();
    }

    private static byte[] wav(byte[] pcm, int sampleRate) {
        ByteBuffer wav = ByteBuffer.allocate(44 + pcm.length).order(ByteOrder.LITTLE_ENDIAN);
        wav.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + pcm.length)
                .put("WAVE".getBytes(StandardCharsets.US_ASCII))
                .put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
                .putInt(sampleRate).putInt(sampleRate * 2).putShort((short) 2).putShort((short) 16)
                .put("data".getBytes(StandardCharsets.US_ASCII)).putInt(pcm.length).put(pcm);
        return wav.array();
    }

    private static void assertMp3(byte[] mp3) {
        assertThat(mp3.length).isGreaterThan(500);
        // MPEG audio frame sync: 11 set bits at the start of the first frame.
        assertThat(mp3[0] & 0xFF).isEqualTo(0xFF);
        assertThat(mp3[1] & 0xE0).isEqualTo(0xE0);
    }
}
