package com.sakiai.backend.security;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static SakiProperties properties(String secret) {
        return new SakiProperties(
                new SakiProperties.Security(secret, Duration.ofHours(1), "saki-ai", null),
                new SakiProperties.Cors(List.of("http://localhost:5173")),
                null, null, null);
    }

    private static String randomSecret() {
        byte[] bytes = new byte[48];
        new java.security.SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void roundTripsUserIdentity() {
        JwtService service = new JwtService(properties(randomSecret()));
        User user = User.builder().id(UUID.randomUUID()).email("nimal@example.com").fullName("Nimal").build();

        SakiUserPrincipal principal = service.parse(service.generateToken(user)).orElseThrow();

        assertThat(principal.id()).isEqualTo(user.getId());
        assertThat(principal.email()).isEqualTo("nimal@example.com");
        assertThat(principal.getName()).isEqualTo(user.getId().toString());
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() {
        JwtService issuer = new JwtService(properties(randomSecret()));
        JwtService verifier = new JwtService(properties(randomSecret()));
        User user = User.builder().id(UUID.randomUUID()).email("a@b.lk").fullName("A").build();

        assertThat(verifier.parse(issuer.generateToken(user))).isEmpty();
    }

    @Test
    void refusesShortSecrets() {
        String shortSecret = Base64.getEncoder().encodeToString(new byte[16]);

        assertThatThrownBy(() -> new JwtService(properties(shortSecret)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void extractsBearerCaseInsensitively() {
        assertThat(JwtService.extractBearer("bearer abc.def")).isEqualTo("abc.def");
        assertThat(JwtService.extractBearer("Basic xyz")).isNull();
    }
}
