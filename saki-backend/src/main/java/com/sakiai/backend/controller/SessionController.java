package com.sakiai.backend.controller;

import com.sakiai.backend.dto.session.CodingSessionDto;
import com.sakiai.backend.dto.session.ConversationMessageDto;
import com.sakiai.backend.dto.session.CreateSessionRequestDto;
import com.sakiai.backend.dto.session.SessionSummaryDto;
import com.sakiai.backend.dto.session.UpdateSessionRequestDto;
import com.sakiai.backend.security.SakiUserPrincipal;
import com.sakiai.backend.service.CodingSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final CodingSessionService sessionService;

    @GetMapping
    public List<SessionSummaryDto> list(@AuthenticationPrincipal SakiUserPrincipal principal) {
        return sessionService.list(principal.id());
    }

    @PostMapping
    public ResponseEntity<CodingSessionDto> create(@AuthenticationPrincipal SakiUserPrincipal principal,
                                                   @Valid @RequestBody(required = false) CreateSessionRequestDto request) {
        CodingSessionDto created = sessionService.create(principal.id(), request);
        return ResponseEntity
                .created(ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").build(created.id()))
                .body(created);
    }

    @GetMapping("/{sessionId}")
    public CodingSessionDto get(@AuthenticationPrincipal SakiUserPrincipal principal,
                                @PathVariable UUID sessionId) {
        return sessionService.get(principal.id(), sessionId);
    }

    @PatchMapping("/{sessionId}")
    public CodingSessionDto update(@AuthenticationPrincipal SakiUserPrincipal principal,
                                   @PathVariable UUID sessionId,
                                   @Valid @RequestBody UpdateSessionRequestDto request) {
        return sessionService.update(principal.id(), sessionId, request);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal SakiUserPrincipal principal,
                                       @PathVariable UUID sessionId) {
        sessionService.delete(principal.id(), sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{sessionId}/messages")
    public List<ConversationMessageDto> messages(@AuthenticationPrincipal SakiUserPrincipal principal,
                                                 @PathVariable UUID sessionId) {
        return sessionService.messages(principal.id(), sessionId);
    }
}
