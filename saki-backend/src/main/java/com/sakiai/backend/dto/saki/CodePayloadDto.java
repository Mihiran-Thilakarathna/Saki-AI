package com.sakiai.backend.dto.saki;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Code shown in the Monaco editor (Web) or the highlighted code view (Flutter).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CodePayloadDto(
        @JsonProperty("hasCode") boolean hasCode,
        String programmingLanguage,
        String fileName,
        String code,
        String explanationMarkdown
) {
    public static CodePayloadDto empty(String explanationMarkdown) {
        return new CodePayloadDto(false, null, null, null, explanationMarkdown);
    }

    /** Collapses inconsistent model output (hasCode=true with blank code, or vice versa) into a coherent payload. */
    public CodePayloadDto normalized() {
        boolean actuallyHasCode = code != null && !code.isBlank();
        if (!actuallyHasCode) {
            return empty(blankToNull(explanationMarkdown));
        }
        return new CodePayloadDto(true,
                blankToNull(programmingLanguage) == null ? "plaintext" : programmingLanguage.trim().toLowerCase(),
                blankToNull(fileName),
                code,
                blankToNull(explanationMarkdown));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
