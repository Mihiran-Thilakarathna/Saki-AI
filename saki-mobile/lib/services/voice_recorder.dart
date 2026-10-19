import 'dart:async';
import 'dart:typed_data';

import 'package:record/record.dart';

import '../core/config.dart';
import '../core/wav.dart';

enum AutoStopReason { trailingSilence, noSpeech, maxDuration }

class RecorderException implements Exception {
  const RecorderException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Records 16 kHz mono PCM via the `record` package's byte stream (identical on
/// Android, iOS and web), exposes a live input level, optionally detects end of
/// speech for hands-free mode, and returns a WAV file for the backend.
class VoiceRecorder {
  VoiceRecorder();

  static const double _speechRms = 0.04;
  static const double _silenceRms = 0.018;
  static const Duration _trailingSilence = Duration(milliseconds: 1600);
  static const Duration _noSpeechTimeout = Duration(seconds: 7);

  final AudioRecorder _recorder = AudioRecorder();
  final _levels = StreamController<double>.broadcast();
  BytesBuilder _buffer = BytesBuilder(copy: false);
  StreamSubscription<Uint8List>? _subscription;
  DateTime? _startedAt;
  bool _heardSpeech = false;
  DateTime? _silenceSince;
  void Function(AutoStopReason reason)? _onAutoStop;
  bool _autoStopFired = false;

  Stream<double> get levels => _levels.stream;
  bool get isRecording => _subscription != null;

  /// Starts capturing. With [onAutoStop] set (hands-free mode), the recorder reports
  /// when the speaker has paused, never spoke, or hit the maximum length.
  Future<void> start({void Function(AutoStopReason reason)? onAutoStop}) async {
    if (isRecording) return;
    if (!await _recorder.hasPermission()) {
      throw const RecorderException('Microphone permission is required to talk to Saki.');
    }
    _buffer = BytesBuilder(copy: false);
    _heardSpeech = false;
    _silenceSince = null;
    _autoStopFired = false;
    _onAutoStop = onAutoStop;

    final Stream<Uint8List> stream;
    try {
      stream = await _recorder.startStream(const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: AudioSettings.sampleRate,
        numChannels: AudioSettings.channels,
        autoGain: true,
        echoCancel: true,
        noiseSuppress: true,
      ));
    } catch (e) {
      throw RecorderException('Could not open the microphone: $e');
    }
    _startedAt = DateTime.now();
    _subscription = stream.listen(_onChunk);
  }

  void _onChunk(Uint8List chunk) {
    _buffer.add(chunk);
    final rms = pcm16Rms(chunk);
    if (!_levels.isClosed) _levels.add(rms);

    final startedAt = _startedAt;
    if (startedAt == null || _autoStopFired) return;
    final now = DateTime.now();
    final elapsed = now.difference(startedAt);

    if (elapsed >= AudioSettings.maxRecording) {
      _fireAutoStop(AutoStopReason.maxDuration);
      return;
    }
    if (_onAutoStop == null) return;
    if (rms > _speechRms) {
      _heardSpeech = true;
      _silenceSince = null;
    } else if (_heardSpeech && rms < _silenceRms) {
      _silenceSince ??= now;
      if (now.difference(_silenceSince!) >= _trailingSilence) _fireAutoStop(AutoStopReason.trailingSilence);
    }
    if (!_heardSpeech && elapsed >= _noSpeechTimeout) _fireAutoStop(AutoStopReason.noSpeech);
  }

  void _fireAutoStop(AutoStopReason reason) {
    _autoStopFired = true;
    final callback = _onAutoStop;
    if (callback != null) {
      callback(reason);
    } else {
      // Push-to-talk hit the hard cap; the caller still gets the audio via stop().
      _onAutoStop = null;
    }
  }

  /// Stops and returns the recording as WAV, or `null` when it is too short to hold a question.
  Future<Uint8List?> stop() async {
    if (!isRecording) return null;
    await _recorder.stop();
    await _subscription?.cancel();
    _subscription = null;
    if (!_levels.isClosed) _levels.add(0);
    final pcm = _buffer.takeBytes();
    final duration = pcm16Duration(pcm.length, sampleRate: AudioSettings.sampleRate, channels: AudioSettings.channels);
    if (duration < AudioSettings.minRecording) return null;
    return pcm16ToWav(pcm, sampleRate: AudioSettings.sampleRate, channels: AudioSettings.channels);
  }

  Future<void> cancel() async {
    if (!isRecording) return;
    await _recorder.cancel();
    await _subscription?.cancel();
    _subscription = null;
    _buffer.clear();
    if (!_levels.isClosed) _levels.add(0);
  }

  Future<void> dispose() async {
    await cancel();
    await _levels.close();
    await _recorder.dispose();
  }
}
