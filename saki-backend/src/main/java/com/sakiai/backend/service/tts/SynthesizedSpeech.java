package com.sakiai.backend.service.tts;

public record SynthesizedSpeech(String audioBase64, String mimeType, String providerId) {

    public static final String MP3_MIME_TYPE = "audio/mpeg";
}
