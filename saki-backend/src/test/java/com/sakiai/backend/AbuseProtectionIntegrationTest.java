package com.sakiai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Brute force, spam, quota draining and oversized bodies are refused before reaching controllers. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:saki-abuse;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.ai.gemini.api-key=",
        "saki.tts.gemini.api-key=",
        "saki.rate-limit.enabled=true",
        "saki.rate-limit.auth-per-minute=3",
        "saki.rate-limit.ai-per-minute=2",
        "saki.rate-limit.ai-per-day=100",
        "saki.rate-limit.writes-per-minute=3",
        "saki.rate-limit.max-json-body-bytes=4096"
})
class AbuseProtectionIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Test
    void passwordGuessingIsCutOffPerClientIp() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"victim@example.lk\",\"password\":\"guess" + i + "xyz\"}"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"victim@example.lk\",\"password\":\"guess3xyz\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.errorCode").value("RATE_LIMITED"));
    }

    @Test
    void spoofedForwardedForHeaderDoesNotBypassTheLimit() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/auth/login").header("X-Forwarded-For", "198.51.100." + i)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"victim@example.lk\",\"password\":\"guess" + i + "xyz\"}"));
        }
        mvc.perform(post("/api/v1/auth/login").header("X-Forwarded-For", "198.51.100.99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"victim@example.lk\",\"password\":\"guess9xyz\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void aiQuestionsAreLimitedPerUserNotGlobally() throws Exception {
        String alice = register("alice");
        String bob = register("bob");
        String aliceSession = session(alice);

        for (int i = 0; i < 2; i++) {
            ask(alice, aliceSession).andExpect(status().isServiceUnavailable()); // no Gemini key in tests
        }
        ask(alice, aliceSession).andExpect(status().isTooManyRequests());
        // Another user is unaffected by Alice's limit.
        ask(bob, session(bob)).andExpect(status().isServiceUnavailable());
    }

    @Test
    void sessionSpamIsLimitedPerUser() throws Exception {
        String user = register("spammer");
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/sessions").header("Authorization", user)).andExpect(status().isCreated());
        }
        mvc.perform(post("/api/v1/sessions").header("Authorization", user)).andExpect(status().isTooManyRequests());
    }

    @Test
    void oversizedJsonBodyIsRejected() throws Exception {
        String huge = "{\"email\":\"" + "a".repeat(10_000) + "@x.lk\",\"password\":\"supersecret1\"}";
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(huge))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.errorCode").value("REQUEST_TOO_LARGE"));
    }

    private String register(String name) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"" + name + "\",\"email\":\"" + name + "-" + UUID.randomUUID()
                                + "@example.lk\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).path("accessToken").asText();
    }

    private String session(String bearer) throws Exception {
        return mapper.readTree(mvc.perform(post("/api/v1/sessions").header("Authorization", bearer))
                .andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    private org.springframework.test.web.servlet.ResultActions ask(String bearer, String sessionId) throws Exception {
        return mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sessionId\":\"" + sessionId + "\",\"query\":\"hello\"}"));
    }
}
