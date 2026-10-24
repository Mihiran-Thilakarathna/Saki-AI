package com.sakiai.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** The voice (MP3) of one Saki answer, stored so it can be replayed later. */
@Entity
@Table(name = "message_audio")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MessageAudio {

    /** Same id as the {@link ConversationMessage} it voices. */
    @Id
    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "mime_type", nullable = false, length = 40)
    private String mimeType;

    @Column(name = "audio", nullable = false, columnDefinition = "BYTEA")
    private byte[] audio;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
