package com.sakiai.backend.service;

import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.CodingSession;
import com.sakiai.backend.domain.ConversationMessage;
import com.sakiai.backend.domain.MessageAudio;
import com.sakiai.backend.domain.SenderRole;
import com.sakiai.backend.domain.User;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.dto.session.CodingSessionDto;
import com.sakiai.backend.dto.session.ConversationMessageDto;
import com.sakiai.backend.dto.session.CreateSessionRequestDto;
import com.sakiai.backend.dto.session.SessionSummaryDto;
import com.sakiai.backend.dto.session.UpdateSessionRequestDto;
import com.sakiai.backend.exception.ResourceNotFoundException;
import com.sakiai.backend.repository.CodingSessionRepository;
import com.sakiai.backend.repository.ConversationMessageRepository;
import com.sakiai.backend.repository.MessageAudioRepository;
import com.sakiai.backend.repository.UserRepository;
import com.sakiai.backend.service.ai.AiReply;
import com.sakiai.backend.service.ai.HistoryTurn;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CodingSessionService {

    private static final int AUTO_TITLE_MAX_CHARS = 60;

    private final CodingSessionRepository sessionRepository;
    private final ConversationMessageRepository messageRepository;
    private final MessageAudioRepository audioRepository;
    private final UserRepository userRepository;
    private final SakiProperties properties;

    // ---------------------------------------------------------------- CRUD

    @Transactional(readOnly = true)
    public List<SessionSummaryDto> list(UUID userId) {
        return sessionRepository.findByUser_IdOrderByUpdatedAtDesc(userId).stream()
                .map(SessionSummaryDto::from)
                .toList();
    }

    @Transactional
    public CodingSessionDto create(UUID userId, CreateSessionRequestDto request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        String title = request == null || request.title() == null || request.title().isBlank()
                ? CodingSession.DEFAULT_TITLE
                : request.title().trim();
        CodingSession session = CodingSession.builder()
                .user(user)
                .title(title)
                .activeLanguage(request == null ? null : blankToNull(request.activeLanguage()))
                .build();
        return CodingSessionDto.from(sessionRepository.save(session));
    }

    @Transactional(readOnly = true)
    public CodingSessionDto get(UUID userId, UUID sessionId) {
        return CodingSessionDto.from(requireOwned(userId, sessionId));
    }

    @Transactional
    public CodingSessionDto update(UUID userId, UUID sessionId, UpdateSessionRequestDto request) {
        CodingSession session = requireOwned(userId, sessionId);
        if (request.title() != null && !request.title().isBlank()) {
            session.setTitle(request.title().trim());
        }
        if (request.activeLanguage() != null) {
            session.setActiveLanguage(blankToNull(request.activeLanguage()));
        }
        if (request.currentCodeContext() != null) {
            session.setCurrentCodeContext(request.currentCodeContext());
        }
        session.setUpdatedAt(Instant.now());
        return CodingSessionDto.from(session);
    }

    @Transactional
    public void delete(UUID userId, UUID sessionId) {
        sessionRepository.delete(requireOwned(userId, sessionId));
    }

    /** Deletes every chat (and its messages) the user owns; returns how many were removed. */
    @Transactional
    public int deleteAll(UUID userId) {
        List<CodingSession> sessions = sessionRepository.findByUser_IdOrderByUpdatedAtDesc(userId);
        sessionRepository.deleteAll(sessions);
        return sessions.size();
    }

    @Transactional(readOnly = true)
    public List<ConversationMessageDto> messages(UUID userId, UUID sessionId) {
        requireOwned(userId, sessionId);
        List<ConversationMessage> messages = messageRepository.findBySession_IdOrderByCreatedAtAsc(sessionId);
        Set<UUID> withAudio = messages.isEmpty() ? Set.of()
                : audioRepository.findStoredIds(messages.stream().map(ConversationMessage::getId).toList());
        return messages.stream()
                .map(message -> ConversationMessageDto.from(message, sessionId, withAudio.contains(message.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isOwner(UUID userId, UUID sessionId) {
        return sessionRepository.existsByIdAndUser_Id(sessionId, userId);
    }

    // ---------------------------------------------------------------- Saki pipeline support

    /**
     * Loads the session snapshot and the most recent conversation turns (chronological)
     * that are replayed to Gemini as context.
     */
    @Transactional(readOnly = true)
    public SessionContext loadContext(UUID userId, UUID sessionId) {
        CodingSession session = requireOwned(userId, sessionId);
        int historySize = properties.ai().historySize();
        List<HistoryTurn> history = new ArrayList<>();
        if (historySize > 0) {
            List<ConversationMessage> recent = new ArrayList<>(
                    messageRepository.findBySession_IdOrderByCreatedAtDesc(sessionId, PageRequest.of(0, historySize)));
            Collections.reverse(recent);
            for (ConversationMessage message : recent) {
                HistoryTurn turn = toHistoryTurn(message);
                if (turn != null) {
                    history.add(turn);
                }
            }
        }
        return new SessionContext(session.getId(), session.getTitle(), session.getActiveLanguage(),
                session.getCurrentCodeContext(), session.getUser().getPreferredLanguage(), history);
    }

    /**
     * Persists the user's query and Saki's answer, then updates the session's live
     * code context so the next query (from any device) sees the latest code.
     *
     * @return the persisted SAKI message (its id becomes the response {@code messageId})
     */
    @Transactional
    public ConversationMessage recordExchange(UUID userId, UUID sessionId, Instant askedAt,
                                              String editorCodeAtAsk, String editorLanguageAtAsk, AiReply reply) {
        CodingSession session = requireOwned(userId, sessionId);
        boolean firstExchange = !messageRepository.existsBySession_Id(sessionId);

        messageRepository.save(ConversationMessage.builder()
                .session(session)
                .senderRole(SenderRole.USER)
                .userTranscript(reply.userTranscript())
                .detectedLanguage(reply.detectedLanguage())
                .createdAt(askedAt)
                .build());

        CodePayloadDto code = reply.codePayload();
        Instant answeredAt = Instant.now();
        if (!answeredAt.isAfter(askedAt)) {
            answeredAt = askedAt.plusMillis(1);
        }
        ConversationMessage sakiMessage = messageRepository.save(ConversationMessage.builder()
                .session(session)
                .senderRole(SenderRole.SAKI)
                .userTranscript(reply.userTranscript())
                .detectedLanguage(reply.detectedLanguage())
                .spokenResponse(reply.spokenResponse())
                .codeSnippet(code.hasCode() ? code.code() : null)
                .programmingLanguage(code.programmingLanguage())
                .fileName(code.fileName())
                .explanationMarkdown(code.explanationMarkdown())
                .createdAt(answeredAt)
                .build());

        if (code.hasCode()) {
            session.setCurrentCodeContext(code.code());
            session.setActiveLanguage(code.programmingLanguage());
        } else if (editorCodeAtAsk != null) {
            session.setCurrentCodeContext(editorCodeAtAsk);
            if (editorLanguageAtAsk != null) {
                session.setActiveLanguage(editorLanguageAtAsk);
            }
        }
        if (firstExchange && CodingSession.isDefaultTitle(session.getTitle())) {
            session.setTitle(autoTitle(reply.userTranscript()));
        }
        session.setUpdatedAt(answeredAt);
        return sakiMessage;
    }

    /** One of Saki's answers in an owned session (404 for anything else). */
    @Transactional(readOnly = true)
    public ConversationMessage sakiMessage(UUID userId, UUID sessionId, UUID messageId) {
        requireOwned(userId, sessionId);
        return messageRepository.findByIdAndSession_Id(messageId, sessionId)
                .filter(message -> message.getSenderRole() == SenderRole.SAKI)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found"));
    }

    /** The stored voice of an answer in an owned session, if there is one. */
    @Transactional(readOnly = true)
    public Optional<MessageAudio> audio(UUID userId, UUID sessionId, UUID messageId) {
        sakiMessage(userId, sessionId, messageId);
        return audioRepository.findById(messageId);
    }

    /** Keeps the voice of an answer so it can be replayed later (replaces an older one). */
    @Transactional
    public void saveAudio(UUID messageId, byte[] audio, String mimeType) {
        audioRepository.save(new MessageAudio(messageId, mimeType, audio, null));
    }

    // ---------------------------------------------------------------- helpers

    private CodingSession requireOwned(UUID userId, UUID sessionId) {
        // Sessions owned by someone else are reported as "not found" to avoid leaking their existence.
        return sessionRepository.findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Coding session not found"));
    }

    private static HistoryTurn toHistoryTurn(ConversationMessage message) {
        if (message.getSenderRole() == SenderRole.USER) {
            return blankToNull(message.getUserTranscript()) == null
                    ? null
                    : new HistoryTurn(SenderRole.USER, message.getUserTranscript());
        }
        StringBuilder text = new StringBuilder();
        if (message.getSpokenResponse() != null) {
            text.append(message.getSpokenResponse());
        }
        if (message.getFileName() != null || message.getCodeSnippet() != null) {
            text.append("\n[Code delivered to the editor");
            if (message.getFileName() != null) {
                text.append(": ").append(message.getFileName());
            }
            if (message.getProgrammingLanguage() != null) {
                text.append(" (").append(message.getProgrammingLanguage()).append(')');
            }
            text.append(']');
        }
        return text.isEmpty() ? null : new HistoryTurn(SenderRole.SAKI, text.toString());
    }

    private static String autoTitle(String transcript) {
        String cleaned = transcript == null ? "" : transcript
                .replaceFirst("(?iu)^\\s*(hey|hello|hi)\\s+saki[\\s,.!?]*", "")
                .replaceFirst("^\\s*හේයි\\s+සකි[\\s,.!?]*", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.isEmpty()) {
            return CodingSession.DEFAULT_TITLE;
        }
        if (cleaned.codePointCount(0, cleaned.length()) <= AUTO_TITLE_MAX_CHARS) {
            return cleaned;
        }
        int end = cleaned.offsetByCodePoints(0, AUTO_TITLE_MAX_CHARS);
        return cleaned.substring(0, end).trim() + "…";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
