package com.sakiai.backend.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

/**
 * Strongly typed view of every {@code saki.*} property in application.yml.
 */
@Validated
@ConfigurationProperties(prefix = "saki")
public record SakiProperties(
        @Valid @NotNull Security security,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Ai ai,
        @Valid @NotNull Tts tts,
        @Valid @NotNull WebSocket websocket
) {

    public record Security(
            @NotBlank(message = "saki.security.jwt-secret (env JWT_SECRET) must be set to a Base64 secret of at least 256 bits")
            String jwtSecret,
            @NotNull Duration jwtExpiration,
            @NotBlank String jwtIssuer,
            /* OAuth "Web application" client ID; blank disables Sign in with Google. */
            String googleClientId
    ) {
        public boolean isGoogleSignInEnabled() {
            return googleClientId != null && !googleClientId.isBlank();
        }
    }

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    public record Ai(
            @Valid @NotNull Gemini gemini,
            @Min(0) int historySize,
            @Min(1000) int maxEditorCodeChars
    ) {
    }

    public record Gemini(
            String apiKey,
            @NotBlank String model,
            /* Tried in order when the main model is overloaded, rate limited or retired. */
            List<String> fallbackModels,
            @NotBlank String baseUrl,
            double temperature,
            @Min(256) int maxOutputTokens,
            Integer thinkingBudget,
            @NotNull Duration timeout,
            @Min(0) int maxRetries
    ) {
        public boolean isConfigured() {
            return apiKey != null && !apiKey.isBlank();
        }

        /** Main model first, then distinct, non-blank fallbacks. */
        public List<String> modelChain() {
            java.util.LinkedHashSet<String> chain = new java.util.LinkedHashSet<>();
            chain.add(model.trim());
            if (fallbackModels != null) {
                fallbackModels.stream().filter(m -> m != null && !m.isBlank()).map(String::trim).forEach(chain::add);
            }
            return List.copyOf(chain);
        }
    }

    public record Tts(
            @NotNull List<String> providers,
            @Min(100) int maxSpokenChars,
            @NotNull Duration timeout,
            /* Send the answer first and its voice later over WebSocket (faster replies). */
            boolean asyncAudio,
            @Valid @NotNull GeminiTts gemini,
            @Valid @NotNull Azure azure,
            @Valid @NotNull Google google
    ) {
    }

    /** Gemini native speech generation; reuses the Gemini API key unless GEMINI_TTS_API_KEY is set. */
    public record GeminiTts(
            String apiKey,
            @NotBlank String model,
            /* Tried in order when the main voice model is out of quota, overloaded or retired. */
            List<String> fallbackModels,
            @NotBlank String sinhalaVoice,
            @NotBlank String englishVoice,
            @Min(32) int mp3BitrateKbps
    ) {
        public boolean isConfigured() {
            return apiKey != null && !apiKey.isBlank();
        }

        /** Main model first, then distinct, non-blank fallbacks. */
        public List<String> modelChain() {
            java.util.LinkedHashSet<String> chain = new java.util.LinkedHashSet<>();
            chain.add(model.trim());
            if (fallbackModels != null) {
                fallbackModels.stream().filter(m -> m != null && !m.isBlank()).map(String::trim).forEach(chain::add);
            }
            return List.copyOf(chain);
        }
    }

    public record Azure(
            String subscriptionKey,
            @NotBlank String region,
            @NotBlank String sinhalaVoice,
            @NotBlank String englishVoice,
            @NotBlank String outputFormat
    ) {
        public boolean isConfigured() {
            return subscriptionKey != null && !subscriptionKey.isBlank();
        }
    }

    public record Google(
            String apiKey,
            String sinhalaVoice,
            String englishVoice
    ) {
        public boolean isConfigured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record WebSocket(
            @NotBlank String endpoint,
            @Min(65536) int maxMessageSizeBytes,
            @Min(524288) int sendBufferSizeBytes
    ) {
    }
}
