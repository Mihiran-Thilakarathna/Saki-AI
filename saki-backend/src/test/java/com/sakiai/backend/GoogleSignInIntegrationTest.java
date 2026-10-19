package com.sakiai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.security.GoogleIdTokenVerifier;
import com.sakiai.backend.security.GoogleIdTokenVerifier.GoogleIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sign in with Google through the real security chain and database. Token verification
 * itself is covered by GoogleIdTokenVerifierTest; here the verifier is stubbed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:saki-google;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.ai.gemini.api-key=",
        "saki.tts.azure.subscription-key=",
        "saki.tts.google.api-key=",
        "saki.tts.gemini.api-key="
})
class GoogleSignInIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockitoBean
    private GoogleIdTokenVerifier verifier;

    @Test
    void providersEndpointIsPublic() throws Exception {
        given(verifier.isEnabled()).willReturn(true);
        given(verifier.clientId()).willReturn("web-client.apps.googleusercontent.com");

        mvc.perform(get("/api/v1/auth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleEnabled").value(true))
                .andExpect(jsonPath("$.googleClientId").value("web-client.apps.googleusercontent.com"));
    }

    @Test
    void firstGoogleSignInCreatesAccountAndSecondReusesIt() throws Exception {
        given(verifier.verify("token-new")).willReturn(new GoogleIdentity("sub-new", "Kasun@Gmail.com", "Kasun"));

        String first = signIn("token-new").andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("kasun@gmail.com"))
                .andExpect(jsonPath("$.user.fullName").value("Kasun"))
                .andExpect(jsonPath("$.user.preferredLanguage").value("si-LK"))
                .andReturn().getResponse().getContentAsString();
        String second = signIn("token-new").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        String id = mapper.readTree(first).at("/user/id").asText();
        org.assertj.core.api.Assertions.assertThat(mapper.readTree(second).at("/user/id").asText()).isEqualTo(id);

        // The issued Saki token works on protected endpoints.
        String bearer = "Bearer " + mapper.readTree(first).path("accessToken").asText();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void googleSignInLinksExistingPasswordAccountAndPasswordStillWorks() throws Exception {
        String registered = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Amaya\",\"email\":\"amaya@gmail.com\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(registered).at("/user/id").asText();
        given(verifier.verify("token-amaya")).willReturn(new GoogleIdentity("sub-amaya", "amaya@gmail.com", "A"));

        signIn("token-amaya").andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(id))
                .andExpect(jsonPath("$.user.fullName").value("Amaya"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"amaya@gmail.com\",\"password\":\"supersecret1\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void googleOnlyAccountCannotLogInWithPassword() throws Exception {
        given(verifier.verify("token-g")).willReturn(new GoogleIdentity("sub-g", "gonly@gmail.com", "G"));
        signIn("token-g").andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"gonly@gmail.com\",\"password\":\"anything123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void differentGoogleAccountForLinkedEmailIsRejected() throws Exception {
        given(verifier.verify("token-1")).willReturn(new GoogleIdentity("sub-1", "shared@gmail.com", "S"));
        given(verifier.verify("token-2")).willReturn(new GoogleIdentity("sub-2", "shared@gmail.com", "S"));
        signIn("token-1").andExpect(status().isOk());

        signIn("token-2").andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("GOOGLE_ACCOUNT_MISMATCH"));
    }

    @Test
    void invalidTokenIsUnauthorized() throws Exception {
        given(verifier.verify("bad")).willThrow(new BadCredentialsException("Invalid Google sign-in token"));

        signIn("bad").andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions signIn(String idToken) throws Exception {
        return mvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON)
                .content("{\"idToken\":\"" + idToken + "\"}"));
    }
}
