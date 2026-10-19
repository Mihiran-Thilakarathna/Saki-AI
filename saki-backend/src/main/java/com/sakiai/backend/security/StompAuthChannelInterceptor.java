package com.sakiai.backend.security;

import com.sakiai.backend.service.CodingSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authenticates STOMP clients (Web IDE and Flutter) with the same JWT used for REST:
 * the CONNECT frame must carry an {@code Authorization: Bearer <token>} native header.
 * SUBSCRIBE frames to a session topic are only allowed for the session's owner, so a
 * paired phone and laptop logged into the same account share one live session.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Pattern SESSION_TOPIC =
            Pattern.compile("^/topic/session/([0-9a-fA-F-]{36})(/events|/audio)?$");

    private final JwtService jwtService;
    private final CodingSessionService sessionService;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        switch (command) {
            case CONNECT, STOMP -> authenticate(accessor);
            case SUBSCRIBE -> authorizeSubscription(accessor);
            case SEND -> requirePrincipal(accessor);
            default -> {
                // DISCONNECT, UNSUBSCRIBE, ACK, NACK, heartbeats: nothing to check.
            }
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION);
        if (header == null) {
            header = accessor.getFirstNativeHeader("authorization");
        }
        String token = JwtService.extractBearer(header);
        Authentication authentication = jwtService.authenticate(token)
                .orElseThrow(() -> new MessageDeliveryException("Unauthorized: missing or invalid JWT in STOMP CONNECT"));
        accessor.setUser(authentication);
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        SakiUserPrincipal principal = requirePrincipal(accessor);
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessageDeliveryException("SUBSCRIBE requires a destination");
        }
        if (destination.startsWith("/user/")) {
            return;
        }
        Matcher matcher = SESSION_TOPIC.matcher(destination);
        if (!matcher.matches()) {
            throw new MessageDeliveryException("Forbidden destination: " + destination);
        }
        UUID sessionId;
        try {
            sessionId = UUID.fromString(matcher.group(1));
        } catch (IllegalArgumentException ex) {
            throw new MessageDeliveryException("Invalid session id in destination: " + destination);
        }
        if (!sessionService.isOwner(principal.id(), sessionId)) {
            log.warn("User {} tried to subscribe to session {} they do not own", principal.id(), sessionId);
            throw new MessageDeliveryException("Forbidden: you do not own session " + sessionId);
        }
    }

    private static SakiUserPrincipal requirePrincipal(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user instanceof Authentication authentication
                && authentication.getPrincipal() instanceof SakiUserPrincipal principal) {
            return principal;
        }
        throw new MessageDeliveryException("Unauthorized: STOMP session is not authenticated");
    }
}
