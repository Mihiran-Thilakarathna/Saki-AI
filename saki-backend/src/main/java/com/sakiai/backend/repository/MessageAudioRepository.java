package com.sakiai.backend.repository;

import com.sakiai.backend.domain.MessageAudio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public interface MessageAudioRepository extends JpaRepository<MessageAudio, UUID> {

    /** Which of the given messages have a stored voice (without loading the audio bytes). */
    @Query("select a.messageId from MessageAudio a where a.messageId in :ids")
    Set<UUID> findStoredIds(@Param("ids") Collection<UUID> ids);
}
