package com.sakiai.backend.service.tts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sakiai.backend.config.HttpClientConfig;
import com.sakiai.backend.config.SakiProperties;
import com.sakiai.backend.domain.SakiLanguage;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Base64;

/**
 * Google Cloud Text-to-Speech (REST v1) fallback provider. English always works with
 * an API key; Sinhala is only attempted when {@code GOOGLE_SINHALA_VOICE} names a
 * voice available to your project, since Sinhala voice coverage varies by Google model.
 */
@Service
public class GoogleCloudTtsService implements TtsService {

    private static final String ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final SakiProperties.Google google;

    public GoogleCloudTtsService(@Qualifier(HttpClientConfig.TTS_CLIENT) RestClient restClient,
                                 ObjectMapper objectMapper,
                                 SakiProperties properties) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.google = properties.tts().google();
    }

    @Override
    public String providerId() {
        return "google";
    }

    @Override
    public boolean supports(String languageTag) {
        if (!google.isConfigured()) {
            return false;
        }
        if (SakiLanguage.SINHALA.equals(SakiLanguage.normalize(languageTag))) {
            return hasText(google.sinhalaVoice());
        }
        return true;
    }

    @Override
    public byte[] synthesize(String text, String languageTag) {
        String language = SakiLanguage.normalize(languageTag);
        String voiceName = SakiLanguage.SINHALA.equals(language) ? google.sinhalaVoice() : google.englishVoice();

        ObjectNode body = objectMapper.createObjectNode();
        body.putObject("input").put("text", text);
        ObjectNode voice = body.putObject("voice");
        voice.put("languageCode", language);
        if (hasText(voiceName)) {
            voice.put("name", voiceName);
        }
        body.putObject("audioConfig").put("audioEncoding", "MP3");

        try {
            JsonNode response = restClient.post()
                    .uri(ENDPOINT)
                    .header("X-Goog-Api-Key", google.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            String audioContent = response == null ? "" : response.path("audioContent").asText("");
            if (audioContent.isEmpty()) {
                throw new TtsException("Google TTS returned empty audio");
            }
            return Base64.getDecoder().decode(audioContent);
        } catch (RestClientResponseException ex) {
            throw new TtsException("Google TTS failed with " + ex.getStatusCode().value()
                    + " for " + language + ": " + ex.getResponseBodyAsString(), ex);
        } catch (RestClientException ex) {
            throw new TtsException("Google TTS unreachable: " + ex.getMessage(), ex);
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
