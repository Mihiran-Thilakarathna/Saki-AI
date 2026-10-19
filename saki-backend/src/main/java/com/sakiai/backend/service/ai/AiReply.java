package com.sakiai.backend.service.ai;

import com.sakiai.backend.dto.saki.CodePayloadDto;

/** Validated, normalized answer from Gemini (before TTS and persistence). */
public record AiReply(
        String userTranscript,
        String detectedLanguage,
        String spokenResponse,
        CodePayloadDto codePayload
) {
}
