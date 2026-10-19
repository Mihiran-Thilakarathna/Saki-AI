import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// Serves in-memory MP3 bytes to just_audio on Android/iOS.
class _BytesAudioSource extends StreamAudioSource {
  _BytesAudioSource(this._bytes, this._contentType);

  final Uint8List _bytes;
  final String _contentType;

  @override
  Future<StreamAudioResponse> request([int? start, int? end]) async {
    final from = start ?? 0;
    final to = end ?? _bytes.length;
    return StreamAudioResponse(
      sourceLength: _bytes.length,
      contentLength: to - from,
      offset: from,
      stream: Stream.value(_bytes.sublist(from, to)),
      contentType: _contentType,
    );
  }
}

class _Clip {
  const _Clip(this.bytes, this.mimeType);
  final Uint8List bytes;
  final String mimeType;
}

/// Plays Saki's server-synthesized neural voice (Base64 MP3), so the phone sounds
/// identical to the Web IDE regardless of the device's installed TTS voices.
class SakiAudioPlayer {
  SakiAudioPlayer() {
    _stateSubscription = _player.playerStateStream.listen((state) {
      final speaking = state.playing && state.processingState != ProcessingState.completed;
      if (speaking != _speaking) {
        _speaking = speaking;
        _speakingController.add(speaking);
      }
    });
  }

  final AudioPlayer _player = AudioPlayer();
  final _speakingController = StreamController<bool>.broadcast();
  late final StreamSubscription<PlayerState> _stateSubscription;
  final Map<String, _Clip> _clips = {};
  bool _speaking = false;
  String? lastMessageId;

  Stream<bool> get speaking => _speakingController.stream;
  bool get isSpeaking => _speaking;
  bool hasClip(String messageId) => _clips.containsKey(messageId);

  /// Caches the clip for replay and plays it unless [autoplay] is false.
  Future<void> load(String messageId, String audioBase64, String? mimeType, {bool autoplay = true}) async {
    _clips[messageId] = _Clip(base64Decode(audioBase64), mimeType ?? 'audio/mpeg');
    if (_clips.length > 30) _clips.remove(_clips.keys.first);
    lastMessageId = messageId;
    if (autoplay) await play(messageId);
  }

  Future<void> play(String messageId) async {
    final clip = _clips[messageId];
    if (clip == null) return;
    lastMessageId = messageId;
    try {
      await _player.stop();
      final AudioSource source = kIsWeb
          ? AudioSource.uri(Uri.dataFromBytes(clip.bytes, mimeType: clip.mimeType))
          : _BytesAudioSource(clip.bytes, clip.mimeType);
      await _player.setAudioSource(source);
      unawaited(_player.play());
    } catch (e) {
      debugPrint('Saki audio playback failed: $e');
    }
  }

  Future<void> replayLast() async {
    final id = lastMessageId;
    if (id != null) await play(id);
  }

  Future<void> stop() => _player.stop();

  Future<void> dispose() async {
    await _stateSubscription.cancel();
    await _speakingController.close();
    await _player.dispose();
  }
}
