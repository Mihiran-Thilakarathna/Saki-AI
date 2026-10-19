import 'dart:math' as math;
import 'dart:typed_data';

/// Wraps raw little-endian PCM16 samples in a RIFF/WAVE header.
/// WAV is used on every platform because Gemini accepts it natively.
Uint8List pcm16ToWav(Uint8List pcm, {required int sampleRate, required int channels}) {
  const bitsPerSample = 16;
  final byteRate = sampleRate * channels * bitsPerSample ~/ 8;
  final blockAlign = channels * bitsPerSample ~/ 8;
  final header = ByteData(44)
    ..setUint32(0, 0x52494646, Endian.big) // "RIFF"
    ..setUint32(4, 36 + pcm.length, Endian.little)
    ..setUint32(8, 0x57415645, Endian.big) // "WAVE"
    ..setUint32(12, 0x666d7420, Endian.big) // "fmt "
    ..setUint32(16, 16, Endian.little) // PCM chunk size
    ..setUint16(20, 1, Endian.little) // audio format = PCM
    ..setUint16(22, channels, Endian.little)
    ..setUint32(24, sampleRate, Endian.little)
    ..setUint32(28, byteRate, Endian.little)
    ..setUint16(32, blockAlign, Endian.little)
    ..setUint16(34, bitsPerSample, Endian.little)
    ..setUint32(36, 0x64617461, Endian.big) // "data"
    ..setUint32(40, pcm.length, Endian.little);
  return (BytesBuilder(copy: false)
        ..add(header.buffer.asUint8List())
        ..add(pcm))
      .takeBytes();
}

/// Root-mean-square level (0..1) of a PCM16 little-endian chunk.
double pcm16Rms(Uint8List chunk) {
  final sampleCount = chunk.length ~/ 2;
  if (sampleCount == 0) return 0;
  final data = ByteData.sublistView(chunk);
  var sum = 0.0;
  for (var i = 0; i < sampleCount; i++) {
    final sample = data.getInt16(i * 2, Endian.little) / 32768.0;
    sum += sample * sample;
  }
  return math.sqrt(sum / sampleCount);
}

/// Duration of [byteCount] bytes of PCM16 audio.
Duration pcm16Duration(int byteCount, {required int sampleRate, required int channels}) =>
    Duration(microseconds: (byteCount / (2 * channels) / sampleRate * 1e6).round());
