package com.sakiai.backend.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Abuse protection ({@code saki.rate-limit.*}): limits per client IP for the public auth
 * endpoints, and per signed-in user for AI questions and session writes. Set
 * {@code enabled=false} only for local load testing.
 */
@Validated
@ConfigurationProperties(prefix = "saki.rate-limit")
public record RateLimitProperties(
        boolean enabled,
        /* Login, sign-up and Google sign-in attempts per IP per minute. */
        @Min(1) int authPerMinute,
        /* AI questions (voice or text) per user per minute and per day. */
        @Min(1) int aiPerMinute,
        @Min(1) int aiPerDay,
        /* Session create / rename / save / delete requests per user per minute. */
        @Min(1) int writesPerMinute,
        /* Largest accepted non-multipart request body (JSON). Uploads are limited by multipart settings. */
        @Min(1024) long maxJsonBodyBytes
) {
}
