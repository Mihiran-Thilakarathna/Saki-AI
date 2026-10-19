package com.sakiai.backend.service.tts;

/** Internal failure of a single TTS provider; {@link SakiTtsService} falls back to the next provider. */
public class TtsException extends RuntimeException {

    public TtsException(String message) {
        super(message);
    }

    public TtsException(String message, Throwable cause) {
        super(message, cause);
    }
}
