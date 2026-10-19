package com.sakiai.backend.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.exception.AiServiceException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiResponseParserTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final GeminiResponseParser parser = new GeminiResponseParser(mapper);

    private String envelope(String modelJson, String finishReason) throws Exception {
        var root = mapper.createObjectNode();
        var candidate = root.putArray("candidates").addObject();
        candidate.put("finishReason", finishReason);
        var parts = candidate.putObject("content").putArray("parts");
        parts.addObject().put("text", "internal reasoning").put("thought", true);
        parts.addObject().put("text", modelJson);
        return mapper.writeValueAsString(root);
    }

    @Test
    void parsesSinhalaReplyWithCode() throws Exception {
        String modelJson = """
                {"userTranscript":"හේයි සකි, Spring Boot වල JWT auth හදන්නේ කොහොමද?",
                 "detectedLanguage":"si-LK",
                 "spokenResponse":"හරි යාළුවා! JWT filter එක `OncePerRequestFilter` එකෙන් හදමු. සම්පූර්ණ code එක editor එකේ තියෙනවා.",
                 "codePayload":{"hasCode":true,"programmingLanguage":"Java","fileName":"JwtAuthenticationFilter.java",
                   "code":"public class JwtAuthenticationFilter {}","explanationMarkdown":"- Filter"}}
                """;

        AiReply reply = parser.parse(envelope(modelJson, "STOP"));

        assertThat(reply.detectedLanguage()).isEqualTo("si-LK");
        assertThat(reply.spokenResponse()).doesNotContain("`").contains("OncePerRequestFilter");
        assertThat(reply.codePayload().hasCode()).isTrue();
        assertThat(reply.codePayload().programmingLanguage()).isEqualTo("java");
        assertThat(reply.codePayload().fileName()).isEqualTo("JwtAuthenticationFilter.java");
    }

    @Test
    void toleratesMarkdownFencesAndNormalizesEmptyCode() throws Exception {
        String modelJson = """
                ```json
                {"userTranscript":"Hey Saki, what is a closure?","detectedLanguage":"en-US",
                 "spokenResponse":"A closure is a function that remembers its surrounding scope.",
                 "codePayload":{"hasCode":true,"programmingLanguage":"","fileName":"","code":"  ","explanationMarkdown":""}}
                ```
                """;

        AiReply reply = parser.parse(envelope(modelJson, "STOP"));

        assertThat(reply.detectedLanguage()).isEqualTo("en-US");
        assertThat(reply.codePayload().hasCode()).isFalse();
        assertThat(reply.codePayload().code()).isNull();
    }

    @Test
    void fallsBackToScriptDetectionForUnknownLanguageTag() throws Exception {
        String modelJson = """
                {"userTranscript":"x","detectedLanguage":"si","spokenResponse":"ඔව්, මට තේරුණා.",
                 "codePayload":{"hasCode":false,"programmingLanguage":"","fileName":"","code":"","explanationMarkdown":""}}
                """;

        assertThat(parser.parse(envelope(modelJson, "STOP")).detectedLanguage()).isEqualTo("si-LK");
    }

    @Test
    void blockedPromptRaisesAiBlocked() {
        String raw = "{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}";

        assertThatThrownBy(() -> parser.parse(raw))
                .isInstanceOf(AiServiceException.class)
                .extracting("errorCode").isEqualTo("AI_BLOCKED");
    }

    @Test
    void truncatedJsonRaisesInvalidResponse() throws Exception {
        String raw = envelope("{\"userTranscript\":\"hi\",\"spokenResponse\":\"Hel", "MAX_TOKENS");

        assertThatThrownBy(() -> parser.parse(raw))
                .isInstanceOf(AiServiceException.class)
                .extracting("errorCode").isEqualTo("AI_INVALID_RESPONSE");
    }
}
