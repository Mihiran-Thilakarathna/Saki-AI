package com.sakiai.backend.repository;

import com.sakiai.backend.domain.CodingSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CodingSessionRepository extends JpaRepository<CodingSession, UUID> {

    List<CodingSession> findByUser_IdOrderByUpdatedAtDesc(UUID userId);

    Optional<CodingSession> findByIdAndUser_Id(UUID id, UUID userId);

    boolean existsByIdAndUser_Id(UUID id, UUID userId);
}
