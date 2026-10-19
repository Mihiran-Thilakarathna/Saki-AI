package com.sakiai.backend.service.tts;

import de.sciss.jump3r.lowlevel.LameEncoder;

import javax.sound.sampled.AudioFormat;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Encodes 16-bit signed little-endian mono PCM to MP3 (pure Java LAME port), and
 * unwraps WAV containers. Keeps every TTS provider's output as compact MP3, so Gemini's
 * 24 kHz PCM does not inflate REST and WebSocket payloads roughly eightfold.
 */
public final class Mp3Encoder {

    private Mp3Encoder() {
    }

    public static byte[] encodePcm16Mono(byte[] pcm, int sampleRate, int bitrateKbps) {
        if (pcm.length < 2) {
            throw new TtsException("No audio samples to encode");
        }
        AudioFormat source = new AudioFormat(sampleRate, 16, 1, true, false);
        LameEncoder encoder = new LameEncoder(source, bitrateKbps, LameEncoder.CHANNEL_MODE_MONO,
                LameEncoder.QUALITY_MIDDLE, false);
        try {
            ByteArrayOutputStream mp3 = new ByteArrayOutputStream(pcm.length / 8 + 4096);
            byte[] out = new byte[encoder.getMP3BufferSize()];
            int chunk = encoder.getPCMBufferSize();
            for (int offset = 0; offset < pcm.length; offset += chunk) {
                int written = encoder.encodeBuffer(pcm, offset, Math.min(chunk, pcm.length - offset), out);
                mp3.write(out, 0, written);
            }
            int tail = encoder.encodeFinish(out);
            mp3.write(out, 0, tail);
            return mp3.toByteArray();
        } finally {
            encoder.close();
        }
    }

    /** Parsed RIFF/WAVE audio: raw PCM plus its format. */
    public record Pcm(byte[] samples, int sampleRate, int channels, int bitsPerSample) {
    }

    public static Pcm parseWav(byte[] wav) {
        ByteBuffer buf = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        if (wav.length < 12 || buf.getInt(0) != 0x46464952 /* RIFF */ || buf.getInt(8) != 0x45564157 /* WAVE */) {
            throw new TtsException("Audio is not a WAV file");
        }
        int sampleRate = 0;
        int channels = 0;
        int bits = 0;
        int pos = 12;
        while (pos + 8 <= wav.length) {
            int id = buf.getInt(pos);
            int size = buf.getInt(pos + 4);
            int body = pos + 8;
            if (id == 0x20746d66 /* "fmt " */) {
                channels = buf.getShort(body + 2);
                sampleRate = buf.getInt(body + 4);
                bits = buf.getShort(body + 14);
            } else if (id == 0x61746164 /* "data" */) {
                // Streamed WAVs may carry a 0 / 0xFFFFFFFF size; take the rest of the file then.
                int length = (size <= 0 || body + size > wav.length) ? wav.length - body : size;
                byte[] samples = new byte[length];
                System.arraycopy(wav, body, samples, 0, length);
                if (sampleRate <= 0) {
                    throw new TtsException("WAV data chunk before fmt chunk");
                }
                return new Pcm(samples, sampleRate, channels, bits);
            }
            if (size < 0) {
                break;
            }
            pos = body + size + (size & 1);
        }
        throw new TtsException("WAV file has no data chunk");
    }
}
