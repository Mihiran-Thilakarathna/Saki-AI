package com.sakiai.backend.service.tts;

import com.sakiai.backend.config.HttpClientConfig;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.SakiLanguage;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;

/**
 * Microsoft Azure Cognitive Services Speech (REST) neural TTS.
 * Uses {@code si-LK-ThiliniNeural}/{@code si-LK-SameeraNeural} for Sinhala and
 * {@code en-US-AvaNeural}/{@code en-US-AndrewNeural} for English (configurable).
 */
@Service
public class AzureTtsService implements TtsService {

    private static final MediaType SSML = new MediaType("application", "ssml+xml", StandardCharsets.UTF_8);

    private final RestClient restClient;
    private final SakiProperties.Azure azure;

    public AzureTtsService(@Qualifier(HttpClientConfig.TTS_CLIENT) RestClient restClient, SakiProperties properties) {
        this.restClient = restClient;
        this.azure = properties.tts().azure();
    }

    @Override
    public String providerId() {
        return "azure";
    }

    @Override
    public boolean supports(String languageTag) {
        return azure.isConfigured();
    }

    @Override
    public byte[] synthesize(String text, String languageTag) {
        String language = SakiLanguage.normalize(languageTag);
        String voice = SakiLanguage.SINHALA.equals(language) ? azure.sinhalaVoice() : azure.englishVoice();
        String ssml = buildSsml(text, language, voice);
        try {
            byte[] audio = restClient.post()
                    .uri("https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", azure.region())
                    .header("Ocp-Apim-Subscription-Key", azure.subscriptionKey())
                    .header("X-Microsoft-OutputFormat", azure.outputFormat())
                    .header("User-Agent", "saki-backend")
                    .contentType(SSML)
                    .body(ssml)
                    .retrieve()
                    .body(byte[].class);
            if (audio == null || audio.length == 0) {
                throw new TtsException("Azure TTS returned empty audio");
            }
            return audio;
        } catch (RestClientResponseException ex) {
            throw new TtsException("Azure TTS failed with " + ex.getStatusCode().value()
                    + " for voice " + voice + ": " + ex.getResponseBodyAsString(), ex);
        } catch (RestClientException ex) {
            throw new TtsException("Azure TTS unreachable: " + ex.getMessage(), ex);
        }
    }

    static String buildSsml(String text, String language, String voice) {
        return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + language + "'>"
                + "<voice xml:lang='" + language + "' name='" + escapeXml(voice) + "'>"
                + escapeXml(text)
                + "</voice></speak>";
    }

    static String escapeXml(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> {
                    // Drop control characters that are illegal in XML 1.0.
                    if (c >= 0x20 || c == '\n' || c == '\r' || c == '\t') {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }
}
