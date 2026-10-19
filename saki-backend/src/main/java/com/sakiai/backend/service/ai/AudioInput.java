package com.sakiai.backend.service.ai;

/** Raw recorded speech plus the Gemini-compatible MIME type resolved by {@link AudioMimeResolver}. */
public record AudioInput(byte[] data, String mimeType) {
}
