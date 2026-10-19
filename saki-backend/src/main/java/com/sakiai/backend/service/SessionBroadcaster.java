package com.sakiai.backend.service;

import com.sakiai.backend.dto.saki.SakiAudioDto;
import com.sakiai.backend.dto.saki.SakiResponseDto;
import com.sakiai.backend.dto.saki.SessionEventDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Publishes Saki answers and lifecycle events to every device subscribed to a session.
 * Broadcast failures are logged, never propagated: the HTTP caller still gets its answer.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public static String responseTopic(UUID sessionId) {
        return "/topic/session/" + sessionId;
    }

    public static String eventsTopic(UUID sessionId) {
        return "/topic/session/" + sessionId + "/events";
    }

    public static String audioTopic(UUID sessionId) {
        return "/topic/session/" + sessionId + "/audio";
    }

    public void publishAudio(SakiAudioDto audio) {
        send(audioTopic(audio.sessionId()), audio);
    }

    public void publishResponse(SakiResponseDto response) {
        send(responseTopic(response.sessionId()), response);
    }

    public void publishEvent(SessionEventDto event) {
        send(eventsTopic(event.sessionId()), event);
    }

    private void send(String destination, Object payload) {
        try {
            messagingTemplate.convertAndSend(destination, payload);
        } catch (MessagingException ex) {
            log.warn("Failed to broadcast to {}: {}", destination, ex.getMessage());
        }
    }
}
