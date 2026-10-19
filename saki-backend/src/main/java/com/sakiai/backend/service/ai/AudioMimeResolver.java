package com.sakiai.backend.service.ai;

import com.sakiai.backend.exception.BadRequestException;

import java.util.Locale;
import java.util.Map;

/**
 * Maps whatever the browser ({@code MediaRecorder}: "audio/webm;codecs=opus") or the
 * Flutter {@code record} plugin (often "application/octet-stream" + a file extension)
 * reports into a MIME type Gemini accepts for inline audio.
 */
public final class AudioMimeResolver {

    private static final Map<String, String> BY_MIME = Map.ofEntries(
            Map.entry("audio/webm", "audio/webm"),
            Map.entry("video/webm", "audio/webm"),
            Map.entry("audio/wav", "audio/wav"),
            Map.entry("audio/wave", "audio/wav"),
            Map.entry("audio/x-wav", "audio/wav"),
            Map.entry("audio/vnd.wave", "audio/wav"),
            Map.entry("audio/mp3", "audio/mp3"),
            Map.entry("audio/mpeg", "audio/mp3"),
            Map.entry("audio/mpeg3", "audio/mp3"),
            Map.entry("audio/aac", "audio/aac"),
            Map.entry("audio/x-aac", "audio/aac"),
            Map.entry("audio/mp4", "audio/mp4"),
            Map.entry("audio/m4a", "audio/mp4"),
            Map.entry("audio/x-m4a", "audio/mp4"),
            Map.entry("audio/ogg", "audio/ogg"),
            Map.entry("audio/opus", "audio/ogg"),
            Map.entry("audio/flac", "audio/flac"),
            Map.entry("audio/x-flac", "audio/flac"),
            Map.entry("audio/aiff", "audio/aiff"),
            Map.entry("audio/x-aiff", "audio/aiff"));

    private static final Map<String, String> BY_EXTENSION = Map.ofEntries(
            Map.entry("webm", "audio/webm"),
            Map.entry("wav", "audio/wav"),
            Map.entry("mp3", "audio/mp3"),
            Map.entry("aac", "audio/aac"),
            Map.entry("m4a", "audio/mp4"),
            Map.entry("mp4", "audio/mp4"),
            Map.entry("ogg", "audio/ogg"),
            Map.entry("oga", "audio/ogg"),
            Map.entry("opus", "audio/ogg"),
            Map.entry("flac", "audio/flac"),
            Map.entry("aif", "audio/aiff"),
            Map.entry("aiff", "audio/aiff"));

    private AudioMimeResolver() {
    }

    public static String resolve(String contentType, String fileName) {
        if (contentType != null && !contentType.isBlank()) {
            String base = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
            String mapped = BY_MIME.get(base);
            if (mapped != null) {
                return mapped;
            }
        }
        if (fileName != null) {
            int dot = fileName.lastIndexOf('.');
            if (dot >= 0 && dot < fileName.length() - 1) {
                String mapped = BY_EXTENSION.get(fileName.substring(dot + 1).toLowerCase(Locale.ROOT));
                if (mapped != null) {
                    return mapped;
                }
            }
        }
        throw new BadRequestException("UNSUPPORTED_AUDIO_FORMAT",
                "Unsupported audio format '" + contentType + "'. Use webm, wav, mp3, aac/m4a, ogg or flac.");
    }
}
