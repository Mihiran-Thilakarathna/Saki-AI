package com.sakiai.backend.dto.saki;

import java.time.Instant;
import java.util.UUID;

/**
 * Lightweight lifecycle events on {@code /topic/session/{sessionId}/events} so a paired
 * client can show "Saki is thinking..." while another device's query is in flight.
 */
public record SessionEventDto(
        Type type,
        UUID sessionId,
        InputMode inputMode,
        String originClientId,
        String message,
        Instant timestamp
) {
    public enum Type { PROCESSING, COMPLETED, FAILED }

    public enum InputMode { VOICE, TEXT }

    public static SessionEventDto of(Type type, UUID sessionId, InputMode mode, String originClientId, String message) {
        return new SessionEventDto(type, sessionId, mode, originClientId, message, Instant.now());
    }
}
