package com.sakiai.backend.dto.auth;

public record AuthResponseDto(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserProfileDto user
) {
    public static AuthResponseDto bearer(String token, long expiresInSeconds, UserProfileDto user) {
        return new AuthResponseDto(token, "Bearer", expiresInSeconds, user);
    }
}
