package com.sakiai.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.service.ai.AiQuery;
import com.sakiai.backend.service.ai.AiReply;
import com.sakiai.backend.service.ai.GeminiResponseParser;
import com.sakiai.backend.service.ai.SakiAiService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the full voice pipeline after the Gemini call (TTS fallback, persistence,
 * session auto-title, code-context update, response shape) with a stubbed AI reply.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:saki-pipeline;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.tts.azure.subscription-key=",
        "saki.tts.google.api-key=",
        "saki.tts.gemini.api-key="
})
class SakiPipelineIntegrationTest {

    static final AtomicReference<AiQuery> LAST_QUERY = new AtomicReference<>();

    @TestConfiguration
    static class StubAiConfig {
        @Bean
        @Primary
        SakiAiService stubSakiAiService(ObjectMapper mapper, SakiProperties properties) {
            return new SakiAiService(RestClient.create(), mapper, new GeminiResponseParser(mapper), properties) {
                @Override
                public AiReply ask(AiQuery query) {
                    LAST_QUERY.set(query);
                    return new AiReply(
                            "හේයි සකි, Spring Boot වල JWT auth හදන්නේ කොහොමද?",
                            "si-LK",
                            "හරි යාළුවා! JWT filter එකක් හදලා තියෙනවා. සම්පූර්ණ code එක editor එකේ බලන්න.",
                            new CodePayloadDto(true, "java", "JwtAuthenticationFilter.java",
                                    "public class JwtAuthenticationFilter {}", "- `OncePerRequestFilter` use කරනවා"));
                }
            };
        }
    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Test
    void voiceQueryPersistsExchangeAndUpdatesSession() throws Exception {
        String auth = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Dilini\",\"email\":\"dilini@example.lk\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + mapper.readTree(auth).path("accessToken").asText();

        String sessionId = mapper.readTree(mvc.perform(post("/api/v1/sessions").header("Authorization", bearer))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("id").asText();

        MockMultipartFile audio = new MockMultipartFile("audioFile", "query.webm",
                "audio/webm;codecs=opus", new byte[4096]);
        String body = mvc.perform(multipart("/api/v1/saki/voice-query").file(audio)
                        .param("sessionId", sessionId)
                        .param("currentEditorCode", "class Old {}")
                        .param("programmingLanguage", "java")
                        .param("clientId", "web-123")
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(sessionId))
                .andExpect(jsonPath("$.messageId").isNotEmpty())
                .andExpect(jsonPath("$.detectedLanguage").value("si-LK"))
                .andExpect(jsonPath("$.codePayload.hasCode").value(true))
                .andExpect(jsonPath("$.codePayload.fileName").value("JwtAuthenticationFilter.java"))
                .andExpect(jsonPath("$.audioBase64").doesNotExist()) // no TTS keys -> graceful text-only
                .andExpect(jsonPath("$.originClientId").value("web-123"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(body).has("audioBase64")).isTrue();

        AiQuery sent = LAST_QUERY.get();
        assertThat(sent.isVoice()).isTrue();
        assertThat(sent.audio().mimeType()).isEqualTo("audio/webm");
        assertThat(sent.editorCode()).isEqualTo("class Old {}");
        assertThat(sent.preferredLanguage()).isEqualTo("si-LK");

        JsonNode messages = mapper.readTree(mvc.perform(get("/api/v1/sessions/{id}/messages", sessionId)
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).path("senderRole").asText()).isEqualTo("USER");
        assertThat(messages.get(1).path("senderRole").asText()).isEqualTo("SAKI");
        assertThat(messages.get(1).path("codeSnippet").asText()).contains("JwtAuthenticationFilter");

        mvc.perform(get("/api/v1/sessions/{id}", sessionId).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentCodeContext").value("public class JwtAuthenticationFilter {}"))
                .andExpect(jsonPath("$.activeLanguage").value("java"))
                // Wake word stripped from the auto-generated title.
                .andExpect(jsonPath("$.title").value("Spring Boot වල JWT auth හදන්නේ කොහොමද?"));

        // Second query replays the first exchange as history.
        mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"%s\",\"query\":\"Add refresh tokens\"}".formatted(sessionId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userTranscript").value("Add refresh tokens"));
        assertThat(LAST_QUERY.get().history()).hasSize(2);
        assertThat(LAST_QUERY.get().editorCode()).isEqualTo("public class JwtAuthenticationFilter {}");
    }
}
