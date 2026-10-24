package com.sakiai.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.service.ai.AiQuery;
import com.sakiai.backend.service.ai.AiReply;
import com.sakiai.backend.service.ai.GeminiResponseParser;
import com.sakiai.backend.service.ai.SakiAiService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.UncheckedIOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs the production schema path against a real PostgreSQL 16 server: the Flyway
 * migration creates the tables, Hibernate validates every entity mapping against them,
 * and a full Saki exchange is persisted (AI reply stubbed, no API keys needed).
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "saki.rate-limit.enabled=false",
        "spring.jpa.hibernate.ddl-auto=validate",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.tts.azure.subscription-key=",
        "saki.tts.google.api-key=",
        "saki.tts.gemini.api-key="
})
@AutoConfigureMockMvc
class PostgresSchemaIntegrationTest {

    private static final EmbeddedPostgres POSTGRES = startPostgres();

    private static EmbeddedPostgres startPostgres() {
        try {
            return EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not start embedded PostgreSQL", e);
        }
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }

    @AfterAll
    static void stopPostgres() throws IOException {
        POSTGRES.close();
    }

    @TestConfiguration
    static class StubAiConfig {
        @Bean
        @Primary
        SakiAiService stubSakiAiService(ObjectMapper mapper, SakiProperties properties) {
            return new SakiAiService(RestClient.create(), mapper, new GeminiResponseParser(mapper), properties) {
                @Override
                public AiReply ask(AiQuery query) {
                    return new AiReply(
                            "හේයි සකි, Spring Boot වල JWT auth හදන්නේ කොහොමද?",
                            "si-LK",
                            "හරි යාළුවා! සම්පූර්ණ code එක editor එකේ බලන්න.",
                            new CodePayloadDto(true, "java", "JwtAuthenticationFilter.java",
                                    "public class JwtAuthenticationFilter {}", "- `OncePerRequestFilter`"));
                }
            };
        }
    }

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void flywaySchemaMatchesEntitiesAndPersistsAFullExchange() throws Exception {
        assertThat(jdbc.queryForObject("SHOW server_version", String.class)).startsWith("16.");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success AND version = '1'", Integer.class))
                .isEqualTo(1);

        String auth = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Pg Tester\",\"email\":\"pg@example.lk\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + mapper.readTree(auth).path("accessToken").asText();

        // Case-insensitive unique email is enforced by the database constraint too.
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Dup\",\"email\":\"PG@example.lk\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isConflict());

        String sessionId = mapper.readTree(mvc.perform(post("/api/v1/sessions").header("Authorization", bearer))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("id").asText();

        MockMultipartFile audio = new MockMultipartFile("audioFile", "q.wav", "audio/wav", new byte[4096]);
        mvc.perform(multipart("/api/v1/saki/voice-query").file(audio)
                        .param("sessionId", sessionId)
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.detectedLanguage").value("si-LK"));

        JsonNode messages = mapper.readTree(mvc.perform(get("/api/v1/sessions/{id}/messages", sessionId)
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).path("senderRole").asText()).isEqualTo("USER");
        assertThat(messages.get(1).path("userTranscript").asText()).contains("හේයි සකි"); // UTF-8 Sinhala round-trip

        mvc.perform(get("/api/v1/sessions/{id}", sessionId).header("Authorization", bearer))
                .andExpect(jsonPath("$.currentCodeContext").value("public class JwtAuthenticationFilter {}"))
                .andExpect(jsonPath("$.title").value("Spring Boot වල JWT auth හදන්නේ කොහොමද?"));

        // Deleting a session cascades to its messages (ON DELETE CASCADE).
        mvc.perform(delete("/api/v1/sessions/{id}", sessionId).header("Authorization", bearer))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM conversation_messages", Integer.class)).isZero();
    }
}
