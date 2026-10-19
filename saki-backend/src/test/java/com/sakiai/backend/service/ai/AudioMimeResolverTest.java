package com.sakiai.backend.service.ai;

import com.sakiai.backend.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AudioMimeResolverTest {

    @Test
    void stripsCodecParameterFromBrowserRecordings() {
        assertThat(AudioMimeResolver.resolve("audio/webm;codecs=opus", "query.webm")).isEqualTo("audio/webm");
    }

    @Test
    void fallsBackToExtensionForOctetStreamUploads() {
        assertThat(AudioMimeResolver.resolve("application/octet-stream", "saki_query.wav")).isEqualTo("audio/wav");
        assertThat(AudioMimeResolver.resolve(null, "voice.m4a")).isEqualTo("audio/mp4");
    }

    @Test
    void rejectsNonAudio() {
        assertThatThrownBy(() -> AudioMimeResolver.resolve("image/png", "photo.png"))
                .isInstanceOf(BadRequestException.class);
    }
}
