package com.sakiai.backend.repository;

import com.sakiai.backend.domain.ConversationMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, UUID> {

    List<ConversationMessage> findBySession_IdOrderByCreatedAtAsc(UUID sessionId);

    /** Newest first; callers reverse the page to get chronological order. */
    List<ConversationMessage> findBySession_IdOrderByCreatedAtDesc(UUID sessionId, Pageable pageable);

    boolean existsBySession_Id(UUID sessionId);
}
