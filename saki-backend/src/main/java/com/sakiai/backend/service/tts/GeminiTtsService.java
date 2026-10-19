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
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Gemini native text-to-speech (e.g. {@code gemini-3.8-flash-tts}). Needs no extra
 * account beyond the Gemini key, speaks Sinhala and Singlish naturally, and is the
 * default first provider. Gemini returns WAV or raw 16-bit PCM, which is re-encoded
 * to MP3 so clients get the same format as from Azure or Google.
 */
@Service
public class GeminiTtsService implements TtsService {

    private static final Pattern PCM_RATE = Pattern.compile("rate=(\\d+)");
    private static final int DEFAULT_PCM_RATE = 24_000;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final SakiProperties.GeminiTts tts;
    private final String baseUrl;

    public GeminiTtsService(@Qualifier(HttpClientConfig.TTS_CLIENT) RestClient restClient,
                            ObjectMapper objectMapper,
                            SakiProperties properties) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.tts = properties.tts().gemini();
        this.baseUrl = properties.ai().gemini().baseUrl();
    }

    @Override
    public String providerId() {
        return "gemini";
    }

    @Override
    public boolean supports(String languageTag) {
        return tts.isConfigured();
    }

    @Override
    public byte[] synthesize(String text, String languageTag) {
        String language = SakiLanguage.normalize(languageTag);
        boolean sinhala = SakiLanguage.SINHALA.equals(language);

        ObjectNode body = objectMapper.createObjectNode();
        body.putArray("contents").addObject()
                // Only the text: Gemini TTS reads any style instruction aloud as part of the speech.
                .putArray("parts").addObject().put("text", text);
        ObjectNode config = body.putObject("generationConfig");
        config.putArray("responseModalities").add("AUDIO");
        config.putObject("speechConfig").putObject("voiceConfig").putObject("prebuiltVoiceConfig")
                .put("voiceName", sinhala ? tts.sinhalaVoice() : tts.englishVoice());

        JsonNode response;
        try {
            response = restClient.post()
                    .uri(baseUrl + "/models/{model}:generateContent", tts.model())
                    .header("x-goog-api-key", tts.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException ex) {
            throw new TtsException("Gemini TTS failed with " + ex.getStatusCode().value()
                    + " for " + language + ": " + ex.getResponseBodyAsString(), ex);
        } catch (RestClientException ex) {
            throw new TtsException("Gemini TTS unreachable: " + ex.getMessage(), ex);
        }

        JsonNode inline = findInlineAudio(response);
        if (inline == null) {
            throw new TtsException("Gemini TTS returned no audio");
        }
        byte[] audio = Base64.getDecoder().decode(inline.path("data").asText(""));
        String mimeType = inline.path("mimeType").asText("").toLowerCase(Locale.ROOT);
        return toMp3(audio, mimeType);
    }

    private static JsonNode findInlineAudio(JsonNode response) {
        if (response == null) {
            return null;
        }
        for (JsonNode part : response.path("candidates").path(0).path("content").path("parts")) {
            JsonNode inline = part.path("inlineData");
            if (inline.hasNonNull("data")) {
                return inline;
            }
        }
        return null;
    }

    private byte[] toMp3(byte[] audio, String mimeType) {
        if (mimeType.contains("mpeg") || mimeType.contains("mp3")) {
            return audio;
        }
        if (mimeType.contains("wav")) {
            Mp3Encoder.Pcm pcm = Mp3Encoder.parseWav(audio);
            if (pcm.channels() != 1 || pcm.bitsPerSample() != 16) {
                throw new TtsException("Unsupported Gemini WAV format: " + pcm.channels() + " ch, "
                        + pcm.bitsPerSample() + " bit");
            }
            return Mp3Encoder.encodePcm16Mono(pcm.samples(), pcm.sampleRate(), tts.mp3BitrateKbps());
        }
        if (mimeType.contains("l16") || mimeType.contains("pcm")) {
            Matcher rate = PCM_RATE.matcher(mimeType);
            int sampleRate = rate.find() ? Integer.parseInt(rate.group(1)) : DEFAULT_PCM_RATE;
            return Mp3Encoder.encodePcm16Mono(audio, sampleRate, tts.mp3BitrateKbps());
        }
        throw new TtsException("Unsupported Gemini TTS audio type: " + mimeType);
    }
}
