package com.sakiai.backend.service.ai;

import java.util.List;

/**
 * Everything Saki's brain needs for one turn. Exactly one of {@code audio} or
 * {@code textQuery} is set.
 */
public record AiQuery(
        String sessionTitle,
        String editorLanguage,
        String editorCode,
        String preferredLanguage,
        List<HistoryTurn> history,
        AudioInput audio,
        String textQuery
) {
    public AiQuery {
        if ((audio == null) == (textQuery == null || textQuery.isBlank())) {
            throw new IllegalArgumentException("Provide exactly one of audio or textQuery");
        }
        history = history == null ? List.of() : List.copyOf(history);
    }

    public boolean isVoice() {
        return audio != null;
    }
}
