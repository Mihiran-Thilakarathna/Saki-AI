package com.sakiai.backend.dto.session;

import com.sakiai.backend.domain.CodingSession;

import java.time.Instant;
import java.util.UUID;

/** Sidebar listing entry; omits the (potentially large) code context. */
public record SessionSummaryDto(
        UUID id,
        String title,
        String activeLanguage,
        Instant createdAt,
        Instant updatedAt
) {
    public static SessionSummaryDto from(CodingSession session) {
        return new SessionSummaryDto(session.getId(), session.getTitle(), session.getActiveLanguage(),
                session.getCreatedAt(), session.getUpdatedAt());
    }
}
