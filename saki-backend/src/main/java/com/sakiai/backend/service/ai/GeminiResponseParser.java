package com.sakiai.backend.service.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.domain.SakiLanguage;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.exception.AiServiceException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Turns a raw Gemini {@code generateContent} response into a validated {@link AiReply}.
 */
@Component
@RequiredArgsConstructor
public class GeminiResponseParser {

    private static final Set<String> BLOCKING_FINISH_REASONS = Set.of(
            "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY");

    private final ObjectMapper objectMapper;

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SakiJson(String userTranscript, String detectedLanguage, String spokenResponse, CodePayloadDto codePayload) {
    }

    public AiReply parse(String rawResponse) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawResponse);
        } catch (JsonProcessingException ex) {
            throw AiServiceException.invalidResponse("Gemini returned a non-JSON envelope", ex);
        }

        String blockReason = root.path("promptFeedback").path("blockReason").asText("");
        if (!blockReason.isEmpty()) {
            throw AiServiceException.blocked(blockReason);
        }

        JsonNode candidate = root.path("candidates").path(0);
        if (candidate.isMissingNode()) {
            throw AiServiceException.invalidResponse("Gemini returned no candidates", null);
        }
        String finishReason = candidate.path("finishReason").asText("");
        if (BLOCKING_FINISH_REASONS.contains(finishReason)) {
            throw AiServiceException.blocked(finishReason);
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            if (part.path("thought").asBoolean(false)) {
                continue;
            }
            text.append(part.path("text").asText(""));
        }
        if (text.isEmpty()) {
            String reason = "MAX_TOKENS".equals(finishReason)
                    ? "Saki ran out of output tokens before answering"
                    : "Gemini returned an empty answer (finishReason=" + finishReason + ")";
            throw AiServiceException.invalidResponse(reason, null);
        }
        return toReply(text.toString(), finishReason);
    }

    AiReply toReply(String modelText, String finishReason) {
        String json = extractJsonObject(modelText);
        SakiJson parsed;
        try {
            parsed = objectMapper.readValue(json, SakiJson.class);
        } catch (JsonProcessingException ex) {
            String hint = "MAX_TOKENS".equals(finishReason) ? " (answer was cut off by the token limit)" : "";
            throw AiServiceException.invalidResponse("Saki's answer did not match the JSON contract" + hint, ex);
        }

        String spoken = SpokenTextSanitizer.sanitize(parsed.spokenResponse());
        if (spoken.isBlank()) {
            throw AiServiceException.invalidResponse("Saki's answer had an empty spokenResponse", null);
        }
        CodePayloadDto code = parsed.codePayload() == null
                ? CodePayloadDto.empty(null)
                : parsed.codePayload().normalized();
        String language = SakiLanguage.isSupported(parsed.detectedLanguage())
                ? parsed.detectedLanguage()
                : guessLanguage(spoken, parsed.detectedLanguage());
        String transcript = parsed.userTranscript() == null ? "" : parsed.userTranscript().trim();
        return new AiReply(transcript, language, spoken, code);
    }

    /** Tolerates stray markdown fences or prose around the JSON object. */
    static String extractJsonObject(String text) {
        String trimmed = text.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw AiServiceException.invalidResponse("Saki's answer contained no JSON object", null);
        }
        return trimmed.substring(start, end + 1);
    }

    /** If the model emitted an unexpected tag, fall back to script detection on the spoken text. */
    static String guessLanguage(String spoken, String reportedTag) {
        long sinhalaChars = spoken.codePoints()
                .filter(cp -> Character.UnicodeBlock.of(cp) == Character.UnicodeBlock.SINHALA)
                .count();
        if (sinhalaChars > 0) {
            return SakiLanguage.SINHALA;
        }
        return reportedTag == null ? SakiLanguage.ENGLISH : SakiLanguage.normalize(reportedTag);
    }
}
