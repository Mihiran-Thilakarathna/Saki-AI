package com.sakiai.backend.security;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class JwtService {

    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_NAME = "name";
    private static final List<SimpleGrantedAuthority> USER_AUTHORITIES = List.of(new SimpleGrantedAuthority("ROLE_USER"));

    private final SecretKey signingKey;
    private final Duration expiration;
    private final String issuer;

    public JwtService(SakiProperties properties) {
        SakiProperties.Security security = properties.security();
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(security.jwtSecret());
        } catch (RuntimeException ex) {
            throw new IllegalStateException("JWT_SECRET must be Base64 encoded (e.g. openssl rand -base64 48)", ex);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must decode to at least 256 bits (32 bytes); got " + keyBytes.length);
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expiration = security.jwtExpiration();
        this.issuer = security.jwtIssuer();
    }

    public String generateToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(user.getId().toString())
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_NAME, user.getFullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiration)))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public long expiresInSeconds() {
        return expiration.toSeconds();
    }

    /**
     * Verifies signature, issuer and expiry. Returns empty for any invalid token
     * rather than throwing, so callers can simply fall through to "unauthenticated".
     */
    public Optional<SakiUserPrincipal> parse(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(new SakiUserPrincipal(
                    UUID.fromString(claims.getSubject()),
                    claims.get(CLAIM_EMAIL, String.class),
                    claims.get(CLAIM_NAME, String.class)));
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Rejected JWT: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<Authentication> authenticate(String token) {
        return parse(token).map(principal ->
                new UsernamePasswordAuthenticationToken(principal, null, USER_AUTHORITIES));
    }

    /** Extracts the raw token from an {@code Authorization: Bearer <token>} header value. */
    public static String extractBearer(String headerValue) {
        if (headerValue == null) {
            return null;
        }
        String trimmed = headerValue.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return null;
    }
}
