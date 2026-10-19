package com.sakiai.backend.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executors;

/**
 * Outbound HTTP clients for Gemini and the TTS providers. Calls are blocking
 * {@link RestClient} calls, which is cheap here because every request runs on a
 * Java 21 virtual thread ({@code spring.threads.virtual.enabled=true}).
 */
@Configuration
public class HttpClientConfig {

    public static final String GEMINI_CLIENT = "geminiRestClient";
    public static final String TTS_CLIENT = "ttsRestClient";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

    @Bean
    @Qualifier(GEMINI_CLIENT)
    public RestClient geminiRestClient(RestClient.Builder builder, SakiProperties properties) {
        SakiProperties.Gemini gemini = properties.ai().gemini();
        return builder.clone()
                .baseUrl(gemini.baseUrl())
                .requestFactory(requestFactory(gemini.timeout()))
                .build();
    }

    @Bean
    @Qualifier(TTS_CLIENT)
    public RestClient ttsRestClient(RestClient.Builder builder, SakiProperties properties) {
        return builder.clone()
                .requestFactory(requestFactory(properties.tts().timeout()))
                .build();
    }

    private static JdkClientHttpRequestFactory requestFactory(Duration readTimeout) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .executor(Executors.newVirtualThreadPerTaskExecutor())
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(readTimeout);
        return factory;
    }
}
