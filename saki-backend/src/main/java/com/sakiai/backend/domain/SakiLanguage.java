package com.sakiai.backend.domain;

import java.util.Locale;

/**
 * BCP-47 language tags Saki speaks. Kept as plain strings because they travel
 * unchanged through the JSON contract, Gemini responses and TTS voice lookup.
 */
public final class SakiLanguage {

    public static final String SINHALA = "si-LK";
    public static final String ENGLISH = "en-US";

    private SakiLanguage() {
    }

    /**
     * Normalizes loosely formatted tags ("si", "SI_lk", "en-GB") to a supported tag,
     * falling back to English for anything unrecognized.
     */
    public static String normalize(String tag) {
        if (tag == null || tag.isBlank()) {
            return ENGLISH;
        }
        String lower = tag.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        return lower.startsWith("si") ? SINHALA : ENGLISH;
    }

    public static boolean isSupported(String tag) {
        return SINHALA.equals(tag) || ENGLISH.equals(tag);
    }
}
