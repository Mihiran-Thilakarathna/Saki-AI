package com.sakiai.backend.dto.auth;

/** Public sign-in options, so clients only show "Sign in with Google" when the server supports it. */
public record AuthProvidersDto(boolean googleEnabled, String googleClientId) {
}
