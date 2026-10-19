package com.sakiai.backend.service;

import com.sakiai.backend.service.ai.HistoryTurn;

import java.util.List;
import java.util.UUID;

/** Snapshot of a coding session loaded (outside any long-running transaction) before calling the AI. */
public record SessionContext(
        UUID sessionId,
        String title,
        String activeLanguage,
        String storedCode,
        String preferredLanguage,
        List<HistoryTurn> history
) {
}
