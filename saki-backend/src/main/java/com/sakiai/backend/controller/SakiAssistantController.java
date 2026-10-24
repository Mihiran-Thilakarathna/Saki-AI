package com.sakiai.backend.controller;

import com.sakiai.backend.domain.MessageAudio;
import com.sakiai.backend.dto.saki.SakiResponseDto;
import com.sakiai.backend.dto.saki.TextQueryRequestDto;
import com.sakiai.backend.security.SakiUserPrincipal;
import com.sakiai.backend.service.SakiAssistantService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/saki")
@RequiredArgsConstructor
public class SakiAssistantController {

    private final SakiAssistantService assistantService;

    /**
     * Voice query (multipart/form-data).
     *
     * @param audioFile           recorded speech (webm/opus from browsers, wav/aac/m4a from Flutter)
     * @param sessionId           coding session to answer in
     * @param currentEditorCode   live editor contents; falls back to the session's stored code
     * @param programmingLanguage editor language id (e.g. "java")
     * @param clientId            optional per-device id echoed as {@code originClientId} on the broadcast
     */
    @PostMapping(value = "/voice-query", consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public SakiResponseDto voiceQuery(@AuthenticationPrincipal SakiUserPrincipal principal,
                                      @RequestPart("audioFile") MultipartFile audioFile,
                                      @RequestParam("sessionId") UUID sessionId,
                                      @RequestParam(value = "currentEditorCode", required = false)
                                      @Size(max = 200_000) String currentEditorCode,
                                      @RequestParam(value = "programmingLanguage", required = false)
                                      @Size(max = 40) String programmingLanguage,
                                      @RequestParam(value = "clientId", required = false)
                                      @Size(max = 64) String clientId) {
        return assistantService.handleVoiceQuery(principal.id(), sessionId, audioFile,
                currentEditorCode, programmingLanguage, clientId);
    }

    /**
     * Saki's voice for an earlier answer: the saved one, or a newly made one when it has none
     * (counts toward the AI limits, since it may call text-to-speech).
     */
    @PostMapping("/sessions/{sessionId}/messages/{messageId}/voice")
    public ResponseEntity<byte[]> voice(@AuthenticationPrincipal SakiUserPrincipal principal,
                                        @PathVariable UUID sessionId,
                                        @PathVariable UUID messageId) {
        MessageAudio audio = assistantService.voiceFor(principal.id(), sessionId, messageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(audio.getMimeType()))
                .cacheControl(CacheControl.noStore())
                .body(audio.getAudio());
    }

    /** Typed query; still returns spoken TTS audio and code, exactly like a voice query. */
    @PostMapping(value = "/text-query", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public SakiResponseDto textQuery(@AuthenticationPrincipal SakiUserPrincipal principal,
                                     @Valid @RequestBody TextQueryRequestDto request) {
        return assistantService.handleTextQuery(principal.id(), request);
    }
}
