package com.sakiai.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the full application (H2 standing in for PostgreSQL, no Gemini key) and walks
 * the auth -> session -> Saki query flow through the real security filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:saki;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "saki.rate-limit.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.ai.gemini.api-key=",
        "saki.tts.azure.subscription-key=",
        "saki.tts.google.api-key=",
        "saki.tts.gemini.api-key="
})
class SakiApiFlowIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Test
    void authSessionAndQueryFlow() throws Exception {
        // Protected endpoints reject anonymous callers with a JSON 401.
        mvc.perform(get("/api/v1/sessions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));

        String email = "kasun-" + UUID.randomUUID() + "@example.lk";
        String registerBody = """
                {"fullName":"Kasun Perera","email":"%s","password":"supersecret1","preferredLanguage":"si-LK"}
                """.formatted(email);
        String registered = mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(registerBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.preferredLanguage").value("si-LK"))
                .andReturn().getResponse().getContentAsString();

        // Duplicate email -> 409.
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("EMAIL_IN_USE"));

        // Wrong password -> 401.
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"wrong-password\"}".formatted(email)))
                .andExpect(status().isUnauthorized());

        String token = mapper.readTree(registered).path("accessToken").asText();
        String bearer = "Bearer " + token;

        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        String created = mvc.perform(post("/api/v1/sessions").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"activeLanguage\":\"java\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("New chat"))
                .andReturn().getResponse().getContentAsString();
        JsonNode session = mapper.readTree(created);
        String sessionId = session.path("id").asText();

        mvc.perform(get("/api/v1/sessions").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(sessionId));

        mvc.perform(get("/api/v1/sessions/{id}/messages", sessionId).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Unknown session -> 404, not 403 (no existence leak).
        mvc.perform(get("/api/v1/sessions/{id}", UUID.randomUUID()).header("Authorization", bearer))
                .andExpect(status().isNotFound());

        // Text query reaches the AI layer, which reports it is not configured (no GEMINI_API_KEY in tests).
        mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"%s\",\"query\":\"Hey Saki, explain records\"}".formatted(sessionId)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("AI_NOT_CONFIGURED"));

        // Voice query with an unsupported upload is rejected before any AI call.
        MockMultipartFile image = new MockMultipartFile("audioFile", "photo.png", "image/png", new byte[1024]);
        mvc.perform(multipart("/api/v1/saki/voice-query").file(image)
                        .param("sessionId", sessionId)
                        .header("Authorization", bearer))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("UNSUPPORTED_AUDIO_FORMAT"));

        // Missing body field -> validation error with field details.
        mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"%s\",\"query\":\"\"}".formatted(sessionId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.query").exists());
    }
}
