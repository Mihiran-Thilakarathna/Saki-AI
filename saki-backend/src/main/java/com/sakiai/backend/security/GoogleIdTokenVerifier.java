package com.sakiai.backend.security;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Verifies a "Sign in with Google" ID token: RS256 signature against Google's published
 * keys (fetched and cached by Nimbus), issuer, expiry, audience = our OAuth client ID, and
 * a verified email. Only then is the Google identity trusted.
 */
@Component
public class GoogleIdTokenVerifier {

    static final String GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> GOOGLE_ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;
    private final JwtDecoder decoder;

    @Autowired
    public GoogleIdTokenVerifier(SakiProperties properties) {
        this(properties.security().googleClientId(), NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWKS_URI).build());
    }

    GoogleIdTokenVerifier(String clientId, JwtDecoder decoder) {
        this.clientId = clientId;
        this.decoder = decoder;
        if (decoder instanceof NimbusJwtDecoder nimbus) {
            nimbus.setJwtValidator(validator(clientId));
        }
    }

    public String clientId() {
        return clientId;
    }

    public boolean isEnabled() {
        return clientId != null && !clientId.isBlank();
    }

    public GoogleIdentity verify(String idToken) {
        if (!isEnabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_SIGN_IN_DISABLED",
                    "Sign in with Google is not configured on this server (set GOOGLE_CLIENT_ID)");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException ex) {
            throw new BadCredentialsException("Invalid Google sign-in token", ex);
        }
        return new GoogleIdentity(jwt.getSubject(), jwt.getClaimAsString("email"), jwt.getClaimAsString("name"));
    }

    static OAuth2TokenValidator<Jwt> validator(String clientId) {
        OAuth2TokenValidator<Jwt> googleClaims = jwt -> {
            String issuer = jwt.getClaimAsString("iss");
            if (issuer == null || !GOOGLE_ISSUERS.contains(issuer)) {
                return failure("Token was not issued by Google");
            }
            if (jwt.getAudience() == null || !jwt.getAudience().contains(clientId)) {
                return failure("Token was issued for a different app");
            }
            Object verified = jwt.getClaim("email_verified");
            boolean emailVerified = Boolean.TRUE.equals(verified) || "true".equals(String.valueOf(verified));
            if (jwt.getClaimAsString("email") == null || !emailVerified) {
                return failure("Google account email is not verified");
            }
            return OAuth2TokenValidatorResult.success();
        };
        return new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(), googleClaims);
    }

    private static OAuth2TokenValidatorResult failure(String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", description, null));
    }

    /** The parts of a verified Google ID token Saki uses. */
    public record GoogleIdentity(String subject, String email, String name) {
    }
}
