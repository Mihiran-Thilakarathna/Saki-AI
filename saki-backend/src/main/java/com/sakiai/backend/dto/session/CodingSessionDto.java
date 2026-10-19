package com.sakiai.backend.dto.session;

import com.sakiai.backend.domain.CodingSession;

import java.time.Instant;
import java.util.UUID;

public record CodingSessionDto(
        UUID id,
        String title,
        String activeLanguage,
        String currentCodeContext,
        Instant createdAt,
        Instant updatedAt
) {
    public static CodingSessionDto from(CodingSession session) {
        return new CodingSessionDto(session.getId(), session.getTitle(), session.getActiveLanguage(),
                session.getCurrentCodeContext(), session.getCreatedAt(), session.getUpdatedAt());
    }
}
