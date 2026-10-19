package com.sakiai.backend.service.tts;

/**
 * Strategy for a server-side neural text-to-speech provider. Implementations return
 * MP3 bytes so Web and Flutter clients play identical audio without local voice packs.
 */
public interface TtsService {

    /** Stable provider id used in {@code saki.tts.providers} ordering (e.g. "azure", "google"). */
    String providerId();

    /** True when the provider has credentials and a voice for the given language tag. */
    boolean supports(String languageTag);

    /**
     * Synthesizes speech for {@code text} in {@code languageTag} ({@code si-LK} or {@code en-US}).
     *
     * @throws TtsException when the provider fails
     */
    byte[] synthesize(String text, String languageTag);
}
