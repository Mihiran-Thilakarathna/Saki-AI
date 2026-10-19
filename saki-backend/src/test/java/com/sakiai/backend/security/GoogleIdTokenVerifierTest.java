package com.sakiai.backend.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sakiai.backend.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "1234-saki.apps.googleusercontent.com";
    private static final KeyPair GOOGLE_KEYS = rsaKeys();
    private static final KeyPair OTHER_KEYS = rsaKeys();

    private final GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier(CLIENT_ID,
            NimbusJwtDecoder.withPublicKey((RSAPublicKey) GOOGLE_KEYS.getPublic()).build());

    @Test
    void acceptsValidGoogleToken() {
        GoogleIdTokenVerifier.GoogleIdentity identity = verifier.verify(token(GOOGLE_KEYS, c -> { }));

        assertThat(identity.subject()).isEqualTo("google-sub-42");
        assertThat(identity.email()).isEqualTo("nimal@gmail.com");
        assertThat(identity.name()).isEqualTo("Nimal Perera");
    }

    @Test
    void acceptsIssuerWithoutScheme() {
        assertThat(verifier.verify(token(GOOGLE_KEYS, c -> c.issuer("accounts.google.com"))).subject())
                .isEqualTo("google-sub-42");
    }

    @Test
    void rejectsTokenForAnotherApp() {
        assertRejected(token(GOOGLE_KEYS, c -> c.audience("someone-else.apps.googleusercontent.com")));
    }

    @Test
    void rejectsNonGoogleIssuer() {
        assertRejected(token(GOOGLE_KEYS, c -> c.issuer("https://evil.example.com")));
    }

    @Test
    void rejectsUnverifiedEmail() {
        assertRejected(token(GOOGLE_KEYS, c -> c.claim("email_verified", false)));
    }

    @Test
    void rejectsExpiredToken() {
        assertRejected(token(GOOGLE_KEYS, c -> c.expirationTime(Date.from(Instant.now().minusSeconds(3600)))));
    }

    @Test
    void rejectsForgedSignature() {
        assertRejected(token(OTHER_KEYS, c -> { }));
    }

    @Test
    void rejectsGarbage() {
        assertRejected("not-a-jwt");
    }

    @Test
    void disabledWithoutClientId() {
        GoogleIdTokenVerifier disabled = new GoogleIdTokenVerifier("",
                NimbusJwtDecoder.withPublicKey((RSAPublicKey) GOOGLE_KEYS.getPublic()).build());

        assertThat(disabled.isEnabled()).isFalse();
        assertThatThrownBy(() -> disabled.verify(token(GOOGLE_KEYS, c -> { })))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("GOOGLE_CLIENT_ID");
    }

    private void assertRejected(String idToken) {
        assertThatThrownBy(() -> verifier.verify(idToken)).isInstanceOf(BadCredentialsException.class);
    }

    private static String token(KeyPair keys, Consumer<JWTClaimsSet.Builder> customize) {
        Instant now = Instant.now();
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("google-sub-42")
                .claim("email", "nimal@gmail.com")
                .claim("email_verified", true)
                .claim("name", "Nimal Perera")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(3600)));
        customize.accept(claims);
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims.build());
            jwt.sign(new RSASSASigner(keys.getPrivate()));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static KeyPair rsaKeys() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
