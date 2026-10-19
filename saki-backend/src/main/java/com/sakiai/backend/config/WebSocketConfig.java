package com.sakiai.backend.config;

import com.sakiai.backend.security.StompAuthChannelInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * STOMP over WebSocket for real-time Web IDE &lt;-&gt; Flutter sync.
 *
 * <ul>
 *   <li>Native WebSocket endpoint: {@code ws://host:8080/ws} (Flutter {@code stomp_dart_client}, {@code @stomp/stompjs})</li>
 *   <li>SockJS fallback endpoint: {@code http://host:8080/ws/sockjs}</li>
 *   <li>Saki answers: {@code /topic/session/{sessionId}}</li>
 *   <li>Lifecycle events ("thinking..."): {@code /topic/session/{sessionId}/events}</li>
 * </ul>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final long[] HEARTBEAT_MILLIS = {10_000, 10_000};

    private final SakiProperties properties;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;
    private TaskScheduler messageBrokerTaskScheduler;

    public WebSocketConfig(SakiProperties properties, StompAuthChannelInterceptor stompAuthChannelInterceptor) {
        this.properties = properties;
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
    }

    @Autowired
    public void setMessageBrokerTaskScheduler(@Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler scheduler) {
        this.messageBrokerTaskScheduler = scheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String endpoint = properties.websocket().endpoint();
        String[] origins = properties.cors().allowedOrigins().toArray(String[]::new);
        registry.addEndpoint(endpoint)
                .setAllowedOriginPatterns(origins);
        registry.addEndpoint(endpoint + "/sockjs")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(HEARTBEAT_MILLIS)
                .setTaskScheduler(messageBrokerTaskScheduler);
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Saki answers carry Base64 MP3 + full source files, well above the 64 KB default.
        registration.setMessageSizeLimit(properties.websocket().maxMessageSizeBytes());
        registration.setSendBufferSizeLimit(properties.websocket().sendBufferSizeBytes());
        registration.setSendTimeLimit(20_000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
