package com.sakiai.backend.dto.saki;

import java.util.UUID;

/**
 * Saki's voice for an answer that was already delivered with {@code audioPending = true},
 * broadcast to {@code /topic/session/{sessionId}/audio} once text-to-speech finishes.
 * {@code audioBase64} is null when no TTS provider could synthesize it; clients then fall
 * back to on-device speech.
 */
public record SakiAudioDto(
        UUID sessionId,
        UUID messageId,
        String audioBase64,
        String audioMimeType,
        String originClientId
) {
}
