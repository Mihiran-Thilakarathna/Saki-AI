package com.sakiai.backend.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sakiai.backend.config.HttpClientConfig;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.SenderRole;
import com.sakiai.backend.exception.AiServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Set;

/**
 * Saki's multimodal brain: sends the recorded speech (or typed query), the live editor
 * code and recent conversation turns to Gemini, and gets back the strict Saki JSON.
 * Gemini transcribes Sinhala / English / Singlish natively, so there is no separate STT step.
 */
@Slf4j
@Service
public class SakiAiService {

    private static final Set<Integer> RETRYABLE_STATUSES = Set.of(429, 500, 502, 503, 504);
    private static final Duration BASE_BACKOFF = Duration.ofMillis(800);
    /** Errors where another model may still answer; auth and bad-request errors are not retried elsewhere. */
    private static final Set<String> FALLBACK_ERROR_CODES =
            Set.of("AI_UPSTREAM_ERROR", "AI_RATE_LIMITED", "AI_QUOTA_EXCEEDED", "AI_MODEL_UNAVAILABLE");

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final GeminiResponseParser parser;
    private final SakiProperties.Gemini gemini;
    private final int maxEditorCodeChars;
    private final ObjectNode responseSchema;

    public SakiAiService(@Qualifier(HttpClientConfig.GEMINI_CLIENT) RestClient restClient,
                         ObjectMapper objectMapper,
                         GeminiResponseParser parser,
                         SakiProperties properties) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.parser = parser;
        this.gemini = properties.ai().gemini();
        this.maxEditorCodeChars = properties.ai().maxEditorCodeChars();
        this.responseSchema = SakiPrompts.responseSchema(objectMapper);
    }

    public AiReply ask(AiQuery query) {
        if (!gemini.isConfigured()) {
            throw AiServiceException.notConfigured();
        }
        ObjectNode body = buildRequest(query);
        long started = System.nanoTime();
        List<String> models = gemini.modelChain();
        for (int i = 0; i < models.size(); i++) {
            String model = models.get(i);
            try {
                // With another model to fall back to, don't spend seconds retrying a busy one.
                int retries = i < models.size() - 1 ? 0 : gemini.maxRetries();
                String raw = callWithRetry(body, model, retries);
                AiReply reply = parser.parse(raw);
                log.info("Gemini {} answered in {} ms (lang={}, hasCode={})", model,
                        Duration.ofNanos(System.nanoTime() - started).toMillis(),
                        reply.detectedLanguage(), reply.codePayload().hasCode());
                return reply;
            } catch (AiServiceException ex) {
                boolean last = i == models.size() - 1;
                if (last || !FALLBACK_ERROR_CODES.contains(ex.getErrorCode())) {
                    throw ex;
                }
                log.warn("Gemini model {} unavailable ({}); falling back to {}", model, ex.getErrorCode(),
                        models.get(i + 1));
            }
        }
        throw AiServiceException.upstream("No Gemini model configured", null);
    }

    // ---------------------------------------------------------------- request building

    ObjectNode buildRequest(AiQuery query) {
        ObjectNode body = objectMapper.createObjectNode();

        body.putObject("systemInstruction")
                .putArray("parts").addObject().put("text", SakiPrompts.SYSTEM_PROMPT);

        ArrayNode contents = body.putArray("contents");
        appendHistory(contents, query.history());

        ObjectNode userTurn = contents.addObject();
        userTurn.put("role", "user");
        ArrayNode parts = userTurn.putArray("parts");
        parts.addObject().put("text", buildContextText(query));
        if (query.isVoice()) {
            parts.addObject().putObject("inlineData")
                    .put("mimeType", query.audio().mimeType())
                    .put("data", Base64.getEncoder().encodeToString(query.audio().data()));
        }

        ObjectNode generationConfig = body.putObject("generationConfig");
        generationConfig.put("responseMimeType", MediaType.APPLICATION_JSON_VALUE);
        generationConfig.set("responseSchema", responseSchema);
        generationConfig.put("temperature", gemini.temperature());
        generationConfig.put("maxOutputTokens", gemini.maxOutputTokens());
        if (gemini.thinkingBudget() != null) {
            generationConfig.putObject("thinkingConfig").put("thinkingBudget", gemini.thinkingBudget());
        }
        return body;
    }

    /**
     * Replays prior turns as alternating user/model contents. Consecutive turns from the
     * same role are merged and a leading model turn is dropped, as Gemini expects the
     * conversation to start with the user.
     */
    private void appendHistory(ArrayNode contents, List<HistoryTurn> history) {
        String lastRole = null;
        ArrayNode lastParts = null;
        for (HistoryTurn turn : history) {
            String role = turn.role() == SenderRole.USER ? "user" : "model";
            if (lastRole == null && "model".equals(role)) {
                continue;
            }
            if (role.equals(lastRole)) {
                lastParts.addObject().put("text", turn.text());
                continue;
            }
            ObjectNode content = contents.addObject();
            content.put("role", role);
            lastParts = content.putArray("parts");
            lastParts.addObject().put("text", turn.text());
            lastRole = role;
        }
        // The new query is a user turn; if history ended on a user turn (e.g. a previous
        // request failed after persisting nothing), keep alternation by closing it.
        if ("user".equals(lastRole)) {
            ObjectNode content = contents.addObject();
            content.put("role", "model");
            content.putArray("parts").addObject().put("text", "(no answer was recorded for that request)");
        }
    }

    private String buildContextText(AiQuery query) {
        StringBuilder text = new StringBuilder(512);
        text.append("[SESSION CONTEXT]\n");
        text.append("Session title: ").append(nullToDash(query.sessionTitle())).append('\n');
        text.append("Editor language: ").append(nullToDash(query.editorLanguage())).append('\n');
        text.append("User's preferred language (only a tie-breaker when speech is ambiguous): ")
                .append(nullToDash(query.preferredLanguage())).append('\n');
        text.append("Current editor code:\n");
        String code = query.editorCode();
        if (code == null || code.isBlank()) {
            text.append("(the editor is empty)\n");
        } else {
            text.append("<<<EDITOR_CODE\n").append(truncateCode(code)).append("\nEDITOR_CODE>>>\n");
        }
        text.append('\n');
        if (query.isVoice()) {
            text.append("[TASK]\nThe attached audio is the user's spoken query to Saki. Transcribe it exactly into ")
                    .append("\"userTranscript\", detect whether it is primarily Sinhala or English, and answer ")
                    .append("following every rule in your instructions. Respond with the JSON object only.");
        } else {
            text.append("[TASK]\nThe user typed this query to Saki. Copy it into \"userTranscript\" and answer ")
                    .append("following every rule in your instructions. Respond with the JSON object only.\n\n")
                    .append("[USER QUERY]\n").append(query.textQuery().trim());
        }
        return text.toString();
    }

    /** Keeps the head and tail of very large files so imports and the most recent edits both survive. */
    private String truncateCode(String code) {
        if (code.length() <= maxEditorCodeChars) {
            return code;
        }
        int head = (int) (maxEditorCodeChars * 0.7);
        int tail = maxEditorCodeChars - head;
        return code.substring(0, head)
                + "\n/* ... " + (code.length() - maxEditorCodeChars) + " characters omitted by Saki ... */\n"
                + code.substring(code.length() - tail);
    }

    // ---------------------------------------------------------------- transport

    private String callWithRetry(ObjectNode body, String model, int maxRetries) {
        String path = "/models/{model}:generateContent";
        int attempts = maxRetries + 1;
        RuntimeException lastError = null;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                String response = restClient.post()
                        .uri(path, model)
                        .header("x-goog-api-key", gemini.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
                if (response == null || response.isBlank()) {
                    throw AiServiceException.invalidResponse("Gemini returned an empty body", null);
                }
                return response;
            } catch (RestClientResponseException ex) {
                lastError = ex;
                HttpStatusCode status = ex.getStatusCode();
                if (!RETRYABLE_STATUSES.contains(status.value()) || attempt == attempts) {
                    throw translate(ex, model);
                }
                log.warn("Gemini returned {} (attempt {}/{}), retrying", status.value(), attempt, attempts);
            } catch (ResourceAccessException ex) {
                lastError = ex;
                if (attempt == attempts) {
                    throw AiServiceException.upstream("Could not reach Gemini: " + ex.getMessage(), ex);
                }
                log.warn("Gemini I/O error (attempt {}/{}): {}", attempt, attempts, ex.getMessage());
            }
            sleepBackoff(attempt);
        }
        throw AiServiceException.upstream("Gemini call failed", lastError);
    }

    private AiServiceException translate(RestClientResponseException ex, String model) {
        int status = ex.getStatusCode().value();
        String upstreamMessage = extractGoogleErrorMessage(ex.getResponseBodyAsString());
        log.error("Gemini {} error {}: {}", model, status, upstreamMessage);
        if (status == 400) {
            return new AiServiceException(HttpStatus.BAD_GATEWAY, "AI_REQUEST_REJECTED",
                    "Gemini rejected the request: " + upstreamMessage, ex);
        }
        if (status == 404) {
            // Google retires models for new keys; this is a configuration problem, not an outage.
            return new AiServiceException(HttpStatus.SERVICE_UNAVAILABLE, "AI_MODEL_UNAVAILABLE",
                    "Gemini model '" + model + "' is not available for this API key. "
                            + "Set GEMINI_MODEL to a current model. Google said: " + upstreamMessage, ex);
        }
        if (status == 401 || status == 403) {
            return new AiServiceException(HttpStatus.SERVICE_UNAVAILABLE, "AI_AUTH_FAILED",
                    "Gemini rejected the API key. Check GEMINI_API_KEY on the backend.", ex);
        }
        if (status == 429 && upstreamMessage.toLowerCase(java.util.Locale.ROOT).contains("quota")) {
            return new AiServiceException(HttpStatus.TOO_MANY_REQUESTS, "AI_QUOTA_EXCEEDED",
                    "Saki has used up its Gemini API quota for now. Free-tier quotas reset daily; to keep going, "
                            + "enable billing for the API key in Google AI Studio.", ex);
        }
        if (status == 429) {
            return new AiServiceException(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMITED",
                    "Saki is getting too many requests right now. Please wait a moment and try again.", ex);
        }
        return AiServiceException.upstream(
                "Saki's AI service is busy right now (Gemini " + status + "). Please try again in a moment.", ex);
    }

    private String extractGoogleErrorMessage(String body) {
        try {
            String message = objectMapper.readTree(body).path("error").path("message").asText("");
            return message.isBlank() ? body : message;
        } catch (Exception ignored) {
            return body;
        }
    }

    private static void sleepBackoff(int attempt) {
        long millis = BASE_BACKOFF.toMillis() * (1L << (attempt - 1));
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw AiServiceException.upstream("Interrupted while waiting to retry Gemini", ie);
        }
    }

    private static String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
