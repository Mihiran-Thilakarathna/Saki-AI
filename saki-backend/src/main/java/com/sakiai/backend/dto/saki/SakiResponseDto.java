package com.sakiai.backend.dto.saki;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/**
 * The unified Saki reply returned over HTTP and broadcast to {@code /topic/session/{sessionId}}.
 *
 * <p>{@code originClientId} echoes the optional {@code clientId} the caller sent, so the
 * client that asked the question can ignore its own WebSocket echo (and avoid playing the
 * audio twice) while every other paired client reacts to it.
 *
 * <p>When {@code audioPending} is true the answer was sent before its voice was ready;
 * the audio follows on {@code /topic/session/{sessionId}/audio} as a {@link SakiAudioDto}.
 */
@Builder(toBuilder = true)
public record SakiResponseDto(
        UUID sessionId,
        UUID messageId,
        String userTranscript,
        String detectedLanguage,
        String spokenResponse,
        String audioBase64,
        String audioMimeType,
        boolean audioPending,
        CodePayloadDto codePayload,
        Instant timestamp,
        String originClientId
) {
}
