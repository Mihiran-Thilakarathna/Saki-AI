package com.sakiai.backend.dto.session;

import com.sakiai.backend.domain.ConversationMessage;
import com.sakiai.backend.domain.SenderRole;

import java.time.Instant;
import java.util.UUID;

public record ConversationMessageDto(
        UUID id,
        UUID sessionId,
        SenderRole senderRole,
        String userTranscript,
        String detectedLanguage,
        String spokenResponse,
        String codeSnippet,
        String programmingLanguage,
        String fileName,
        String explanationMarkdown,
        Instant createdAt,
        /* Saki's voice for this answer is stored and can be fetched from .../messages/{id}/audio. */
        boolean hasAudio
) {
    public static ConversationMessageDto from(ConversationMessage message, UUID sessionId, boolean hasAudio) {
        return new ConversationMessageDto(message.getId(), sessionId, message.getSenderRole(),
                message.getUserTranscript(), message.getDetectedLanguage(), message.getSpokenResponse(),
                message.getCodeSnippet(), message.getProgrammingLanguage(), message.getFileName(),
                message.getExplanationMarkdown(), message.getCreatedAt(), hasAudio);
    }
}
