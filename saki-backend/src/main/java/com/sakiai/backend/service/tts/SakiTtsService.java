package com.sakiai.backend.service.tts;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.SakiLanguage;
import com.sakiai.backend.service.ai.SpokenTextSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Picks Saki's voice from {@code detectedLanguage} and walks the configured provider
 * chain (default: Gemini, then Azure, then Google). TTS is best-effort: if every provider fails the
 * answer is still delivered with {@code audioBase64 = null}, and clients can fall back
 * to on-device speech.
 */
@Slf4j
@Service
public class SakiTtsService {

    private final List<TtsService> chain;
    private final int maxSpokenChars;

    public SakiTtsService(List<TtsService> providers, SakiProperties properties) {
        Map<String, TtsService> byId = providers.stream()
                .collect(Collectors.toMap(p -> p.providerId().toLowerCase(Locale.ROOT), Function.identity()));
        List<TtsService> ordered = new ArrayList<>();
        for (String id : properties.tts().providers()) {
            TtsService provider = byId.get(id.trim().toLowerCase(Locale.ROOT));
            if (provider == null) {
                log.warn("Unknown TTS provider '{}' in saki.tts.providers; known: {}", id, byId.keySet());
            } else if (!ordered.contains(provider)) {
                ordered.add(provider);
            }
        }
        this.chain = List.copyOf(ordered);
        this.maxSpokenChars = properties.tts().maxSpokenChars();
        log.info("Saki TTS provider chain: {}", chain.stream().map(TtsService::providerId).toList());
    }

    /** True when at least one configured provider can speak this language. */
    public boolean canSynthesize(String detectedLanguage) {
        String language = SakiLanguage.normalize(detectedLanguage);
        return chain.stream().anyMatch(provider -> provider.supports(language));
    }

    public Optional<SynthesizedSpeech> synthesize(String spokenText, String detectedLanguage) {
        if (spokenText == null || spokenText.isBlank()) {
            return Optional.empty();
        }
        String language = SakiLanguage.normalize(detectedLanguage);
        String text = SpokenTextSanitizer.truncateForSpeech(spokenText, maxSpokenChars);

        for (TtsService provider : chain) {
            if (!provider.supports(language)) {
                continue;
            }
            long started = System.nanoTime();
            try {
                byte[] mp3 = provider.synthesize(text, language);
                log.debug("TTS {} synthesized {} bytes for {} in {} ms", provider.providerId(), mp3.length, language,
                        Duration.ofNanos(System.nanoTime() - started).toMillis());
                return Optional.of(new SynthesizedSpeech(Base64.getEncoder().encodeToString(mp3),
                        SynthesizedSpeech.MP3_MIME_TYPE, provider.providerId()));
            } catch (RuntimeException ex) {
                log.warn("TTS provider {} failed for {}: {}", provider.providerId(), language, ex.getMessage());
            }
        }
        log.warn("No TTS provider could synthesize {} speech; returning text-only answer", language);
        return Optional.empty();
    }
}
