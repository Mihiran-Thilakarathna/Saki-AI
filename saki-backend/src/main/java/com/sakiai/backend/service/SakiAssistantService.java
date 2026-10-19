package com.sakiai.backend.service;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.ConversationMessage;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.dto.saki.SakiAudioDto;
import com.sakiai.backend.dto.saki.SakiResponseDto;
import com.sakiai.backend.dto.saki.SessionEventDto;
import com.sakiai.backend.dto.saki.SessionEventDto.InputMode;
import com.sakiai.backend.dto.saki.TextQueryRequestDto;
import com.sakiai.backend.exception.ApiException;
import com.sakiai.backend.exception.BadRequestException;
import com.sakiai.backend.service.ai.AiQuery;
import com.sakiai.backend.service.ai.AiReply;
import com.sakiai.backend.service.ai.AudioInput;
import com.sakiai.backend.service.ai.AudioMimeResolver;
import com.sakiai.backend.service.ai.HistoryTurn;
import com.sakiai.backend.service.ai.SakiAiService;
import com.sakiai.backend.service.ai.SpokenTextSanitizer;
import com.sakiai.backend.service.tts.SakiTtsService;
import com.sakiai.backend.service.tts.SynthesizedSpeech;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The end-to-end Saki pipeline shared by voice and text queries:
 * <ol>
 *   <li>validate the session and load recent context + editor code</li>
 *   <li>ask Gemini (multimodal) for the strict Saki JSON</li>
 *   <li>synthesize {@code spokenResponse} with the neural voice matching {@code detectedLanguage}
 *       (by default in the background: the answer is returned first, the audio follows over WebSocket)</li>
 *   <li>persist the exchange and update the session's live code context</li>
 *   <li>broadcast to {@code /topic/session/{id}} and return the response</li>
 * </ol>
 * Deliberately not {@code @Transactional}: the slow AI/TTS calls must not hold a DB connection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SakiAssistantService {

    /** Below this size a "recording" is just container headers with no speech. */
    private static final int MIN_AUDIO_BYTES = 256;

    private final CodingSessionService sessionService;
    private final SakiAiService aiService;
    private final SakiTtsService ttsService;
    private final SessionBroadcaster broadcaster;
    private final SakiProperties properties;

    /** Background text-to-speech for answers delivered before their audio. */
    private final ExecutorService ttsExecutor = Executors.newVirtualThreadPerTaskExecutor();

    @PreDestroy
    void shutdownTtsExecutor() {
        ttsExecutor.shutdown();
    }

    public SakiResponseDto handleVoiceQuery(UUID userId, UUID sessionId, MultipartFile audioFile,
                                            String currentEditorCode, String programmingLanguage, String clientId) {
        AudioInput audio = readAudio(audioFile);
        return process(userId, sessionId, InputMode.VOICE, clientId, currentEditorCode, programmingLanguage,
                context -> new AiQuery(context.title(), context.editorLanguage(), context.editorCode(),
                        context.preferredLanguage(), context.history(), audio, null));
    }

    public SakiResponseDto handleTextQuery(UUID userId, TextQueryRequestDto request) {
        String query = request.query().trim();
        return process(userId, request.sessionId(), InputMode.TEXT, request.clientId(),
                request.currentEditorCode(), request.programmingLanguage(),
                context -> new AiQuery(context.title(), context.editorLanguage(), context.editorCode(),
                        context.preferredLanguage(), context.history(), null, query));
    }

    // ---------------------------------------------------------------- pipeline

    private record ResolvedContext(String title, String editorLanguage, String editorCode,
                                   String preferredLanguage, List<HistoryTurn> history) {
    }

    @FunctionalInterface
    private interface QueryFactory {
        AiQuery build(ResolvedContext context);
    }

    private SakiResponseDto process(UUID userId, UUID sessionId, InputMode mode, String clientId,
                                    String editorCodeOverride, String languageOverride, QueryFactory queryFactory) {
        Instant askedAt = Instant.now();
        String originClientId = blankToNull(clientId);

        // 1. Validate ownership + load context (short read-only transaction).
        SessionContext session = sessionService.loadContext(userId, sessionId);
        String editorCode = editorCodeOverride != null ? editorCodeOverride : session.storedCode();
        String editorLanguage = blankToNull(languageOverride) != null ? languageOverride.trim() : session.activeLanguage();

        broadcaster.publishEvent(SessionEventDto.of(SessionEventDto.Type.PROCESSING, sessionId, mode,
                originClientId, "Saki is thinking..."));
        try {
            // 2. Gemini multimodal call.
            AiQuery query = queryFactory.build(new ResolvedContext(session.title(), editorLanguage, editorCode,
                    session.preferredLanguage(), session.history()));
            AiReply reply = aiService.ask(query);
            if (!query.isVoice()) {
                // For typed queries the user's own text is authoritative.
                reply = new AiReply(query.textQuery(), reply.detectedLanguage(), reply.spokenResponse(),
                        reply.codePayload());
            }

            // 3. Neural TTS in the detected language (best effort). With async audio the answer
            //    goes out now and the voice follows over WebSocket, saving several seconds.
            boolean audioLater = properties.tts().asyncAudio() && ttsService.canSynthesize(reply.detectedLanguage());
            Optional<SynthesizedSpeech> speech = audioLater
                    ? Optional.empty()
                    : ttsService.synthesize(speechText(reply.spokenResponse(), reply.codePayload()),
                            reply.detectedLanguage());

            // 4. Persist the exchange and update the live code context.
            ConversationMessage saved = sessionService.recordExchange(userId, sessionId, askedAt,
                    editorCodeOverride, blankToNull(languageOverride), reply);

            SakiResponseDto response = SakiResponseDto.builder()
                    .sessionId(sessionId)
                    .messageId(saved.getId())
                    .userTranscript(reply.userTranscript())
                    .detectedLanguage(reply.detectedLanguage())
                    .spokenResponse(reply.spokenResponse())
                    .audioBase64(speech.map(SynthesizedSpeech::audioBase64).orElse(null))
                    .audioMimeType(speech.map(SynthesizedSpeech::mimeType).orElse(null))
                    .audioPending(audioLater)
                    .codePayload(reply.codePayload())
                    .timestamp(saved.getCreatedAt())
                    .originClientId(originClientId)
                    .build();

            // 5. Real-time sync to every paired device.
            broadcaster.publishResponse(response);
            broadcaster.publishEvent(SessionEventDto.of(SessionEventDto.Type.COMPLETED, sessionId, mode,
                    originClientId, null));
            log.info("Saki answered {} query in session {} ({} ms, lang={}, audio={})", mode, sessionId,
                    Duration.between(askedAt, Instant.now()).toMillis(), reply.detectedLanguage(),
                    audioLater ? "pending" : speech.map(SynthesizedSpeech::providerId).orElse("none"));
            if (audioLater) {
                synthesizeLater(response);
            }
            return response;
        } catch (RuntimeException ex) {
            String message = ex instanceof ApiException api ? api.getMessage() : "Saki could not answer this time.";
            broadcaster.publishEvent(SessionEventDto.of(SessionEventDto.Type.FAILED, sessionId, mode,
                    originClientId, message));
            throw ex;
        }
    }

    private void synthesizeLater(SakiResponseDto response) {
        ttsExecutor.execute(() -> {
            long started = System.nanoTime();
            Optional<SynthesizedSpeech> speech = Optional.empty();
            try {
                speech = ttsService.synthesize(speechText(response.spokenResponse(), response.codePayload()),
                        response.detectedLanguage());
            } catch (RuntimeException ex) {
                log.warn("Background TTS failed for message {}: {}", response.messageId(), ex.getMessage());
            }
            // Always publish, even without audio, so clients stop waiting and can fall back.
            broadcaster.publishAudio(new SakiAudioDto(response.sessionId(), response.messageId(),
                    speech.map(SynthesizedSpeech::audioBase64).orElse(null),
                    speech.map(SynthesizedSpeech::mimeType).orElse(null),
                    response.originClientId()));
            log.info("Saki voice for message {} ready in {} ms (audio={})", response.messageId(),
                    Duration.ofNanos(System.nanoTime() - started).toMillis(),
                    speech.map(SynthesizedSpeech::providerId).orElse("none"));
        });
    }

    /** What Saki says aloud: the answer plus its explanation points, never the code itself. */
    private static String speechText(String spokenResponse, CodePayloadDto code) {
        return SpokenTextSanitizer.forSpeech(spokenResponse, code == null ? null : code.explanationMarkdown());
    }

    private static AudioInput readAudio(MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            throw new BadRequestException("AUDIO_MISSING", "audioFile is required and must not be empty");
        }
        if (audioFile.getSize() < MIN_AUDIO_BYTES) {
            throw new BadRequestException("AUDIO_TOO_SHORT", "The recording is too short. Hold the mic a little longer.");
        }
        String mimeType = AudioMimeResolver.resolve(audioFile.getContentType(), audioFile.getOriginalFilename());
        try {
            return new AudioInput(audioFile.getBytes(), mimeType);
        } catch (IOException ex) {
            throw new BadRequestException("AUDIO_UNREADABLE", "Could not read the uploaded audio file");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
