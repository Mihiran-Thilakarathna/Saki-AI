package com.sakiai.backend.service.ai;

import com.sakiai.backend.domain.SenderRole;

/** One prior conversation turn replayed to Gemini as multi-turn context. */
public record HistoryTurn(SenderRole role, String text) {
}
