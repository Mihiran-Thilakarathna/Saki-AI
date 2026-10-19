package com.sakiai.backend.dto.auth;

import com.sakiai.backend.domain.User;

import java.time.Instant;
import java.util.UUID;

public record UserProfileDto(
        UUID id,
        String fullName,
        String email,
        String preferredLanguage,
        Instant createdAt
) {
    public static UserProfileDto from(User user) {
        return new UserProfileDto(user.getId(), user.getFullName(), user.getEmail(),
                user.getPreferredLanguage(), user.getCreatedAt());
    }
}
