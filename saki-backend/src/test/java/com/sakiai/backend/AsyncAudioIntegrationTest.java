package com.sakiai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sakiai.backend.dto.saki.CodePayloadDto;
import com.sakiai.backend.dto.saki.SakiAudioDto;
import com.sakiai.backend.service.SessionBroadcaster;
import com.sakiai.backend.service.ai.AiReply;
import com.sakiai.backend.service.ai.SakiAiService;
import com.sakiai.backend.service.tts.SakiTtsService;
import com.sakiai.backend.service.tts.SynthesizedSpeech;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The answer (text + code) is returned before text-to-speech finishes; the voice then
 * follows on /topic/session/{id}/audio for the same message.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:saki-async-audio;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "saki.security.jwt-secret=c2FraS1haS10ZXN0LXNlY3JldC1rZXktdGhhdC1pcy1sb25nLWVub3VnaC0xMjM0NTY=",
        "saki.tts.async-audio=true"
})
class AsyncAudioIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockitoBean
    private SakiAiService aiService;

    @MockitoBean
    private SakiTtsService ttsService;

    @MockitoBean
    private SessionBroadcaster broadcaster;

    @Test
    void answerIsReturnedBeforeVoiceAndVoiceFollowsOverWebSocket() throws Exception {
        given(aiService.ask(any())).willReturn(new AiReply("Sort a list", "en-US", "The code is in the editor.",
                new CodePayloadDto(true, "python", "sort.py", "print(sorted([3, 1, 2]))", "- `sorted`")));
        given(ttsService.canSynthesize("en-US")).willReturn(true);
        // TTS is slow: it only finishes after the HTTP response has been checked.
        CountDownLatch responseChecked = new CountDownLatch(1);
        given(ttsService.synthesize(anyString(), anyString())).willAnswer(inv -> {
            responseChecked.await(5, TimeUnit.SECONDS);
            return Optional.of(new SynthesizedSpeech("QUJD", SynthesizedSpeech.MP3_MIME_TYPE, "gemini"));
        });

        String bearer = "Bearer " + mapper.readTree(mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Async\",\"email\":\"async@example.lk\",\"password\":\"supersecret1\"}"))
                .andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        String sessionId = mapper.readTree(mvc.perform(post("/api/v1/sessions").header("Authorization", bearer))
                .andReturn().getResponse().getContentAsString()).path("id").asText();

        String body = mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + sessionId + "\",\"query\":\"Sort a list\",\"clientId\":\"web-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.audioPending").value(true))
                .andExpect(jsonPath("$.audioBase64").doesNotExist())
                .andExpect(jsonPath("$.codePayload.fileName").value("sort.py"))
                .andReturn().getResponse().getContentAsString();
        responseChecked.countDown();

        ArgumentCaptor<SakiAudioDto> audio = ArgumentCaptor.forClass(SakiAudioDto.class);
        verify(broadcaster, timeout(5000)).publishAudio(audio.capture());
        assertThat(audio.getValue().messageId().toString()).isEqualTo(mapper.readTree(body).path("messageId").asText());
        assertThat(audio.getValue().audioBase64()).isEqualTo("QUJD");
        assertThat(audio.getValue().audioMimeType()).isEqualTo("audio/mpeg");
        assertThat(audio.getValue().originClientId()).isEqualTo("web-1");
    }

    @Test
    void failedVoiceStillPublishesSoClientsStopWaiting() throws Exception {
        given(aiService.ask(any())).willReturn(new AiReply("Hi", "en-US", "Hello.",
                new CodePayloadDto(false, "plaintext", "", "", "")));
        given(ttsService.canSynthesize("en-US")).willReturn(true);
        given(ttsService.synthesize(anyString(), anyString())).willThrow(new IllegalStateException("tts down"));

        String bearer = "Bearer " + mapper.readTree(mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Async2\",\"email\":\"async2@example.lk\",\"password\":\"supersecret1\"}"))
                .andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        String sessionId = mapper.readTree(mvc.perform(post("/api/v1/sessions").header("Authorization", bearer))
                .andReturn().getResponse().getContentAsString()).path("id").asText();

        mvc.perform(post("/api/v1/saki/text-query").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + sessionId + "\",\"query\":\"Hi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.audioPending").value(true));

        ArgumentCaptor<SakiAudioDto> audio = ArgumentCaptor.forClass(SakiAudioDto.class);
        verify(broadcaster, timeout(5000)).publishAudio(audio.capture());
        assertThat(audio.getValue().audioBase64()).isNull();
    }
}
