import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../core/wake_word_matcher.dart';

/// Background "Hey Saki" trigger on top of the platform speech recognizer.
///
/// Mobile recognizers stop after a pause, so the listener restarts itself while
/// enabled. It must be paused while recording, because Android cannot run the
/// speech recognizer and the audio recorder on the microphone at the same time.
class WakeWordListener {
  WakeWordListener({required this.onWake, required this.onFatalError});

  final VoidCallback onWake;
  final void Function(String message) onFatalError;

  final SpeechToText _speech = SpeechToText();
  final _listening = StreamController<bool>.broadcast();
  bool _initialized = false;
  bool _enabled = false;
  bool _paused = false;
  bool _disposed = false;
  Timer? _restartTimer;
  Duration _backoff = const Duration(milliseconds: 400);

  Stream<bool> get listening => _listening.stream;

  Future<bool> _ensureInitialized() async {
    if (_initialized) return true;
    try {
      _initialized = await _speech.initialize(
        onStatus: _onStatus,
        onError: _onError,
        debugLogging: false,
      );
    } catch (e) {
      debugPrint('Speech recognizer unavailable: $e');
      _initialized = false;
    }
    return _initialized;
  }

  /// Turns hands-free mode on. Returns false when the device has no recognizer or permission.
  Future<bool> enable() async {
    if (!await _ensureInitialized()) return false;
    _enabled = true;
    _scheduleListen(Duration.zero);
    return true;
  }

  Future<void> disable() async {
    _enabled = false;
    await _stopListening();
  }

  /// Temporarily releases the microphone (recording / Saki speaking).
  Future<void> pause() async {
    _paused = true;
    await _stopListening();
  }

  void resume() {
    _paused = false;
    _scheduleListen(const Duration(milliseconds: 300));
  }

  bool get _shouldListen => _enabled && !_paused && !_disposed;

  void _scheduleListen(Duration delay) {
    _restartTimer?.cancel();
    if (!_shouldListen) return;
    _restartTimer = Timer(delay, _listen);
  }

  Future<void> _listen() async {
    if (!_shouldListen || _speech.isListening) return;
    try {
      await _speech.listen(
        onResult: _onResult,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: false,
          listenMode: ListenMode.dictation,
          localeId: 'en_US',
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 8),
        ),
      );
      _setListening(true);
    } catch (e) {
      debugPrint('Wake-word listen failed: $e');
      _backoff = _nextBackoff();
      _scheduleListen(_backoff);
    }
  }

  void _onResult(SpeechRecognitionResult result) {
    _backoff = const Duration(milliseconds: 400);
    final heard = result.alternates.any((a) => detectWakeWord(a.recognizedWords));
    if (heard && _shouldListen) {
      _paused = true; // The voice controller resumes after Saki's answer.
      unawaited(_stopListening());
      onWake();
    }
  }

  void _onStatus(String status) {
    if (status == SpeechToText.doneStatus || status == SpeechToText.notListeningStatus) {
      _setListening(false);
      _scheduleListen(_backoff);
    }
  }

  void _onError(SpeechRecognitionError error) {
    if (error.errorMsg.contains('permission')) {
      _enabled = false;
      onFatalError('Speech recognition permission was denied, so "Hey Saki" is off. Tap the mic instead.');
      return;
    }
    // error_no_match / error_speech_timeout are routine between phrases.
    if (error.permanent && !error.errorMsg.contains('no_match') && !error.errorMsg.contains('timeout')) {
      _backoff = _nextBackoff();
    }
    _setListening(false);
    _scheduleListen(_backoff);
  }

  Duration _nextBackoff() {
    final next = _backoff * 2;
    return next > const Duration(seconds: 10) ? const Duration(seconds: 10) : next;
  }

  Future<void> _stopListening() async {
    _restartTimer?.cancel();
    if (_speech.isListening) await _speech.cancel();
    _setListening(false);
  }

  void _setListening(bool value) {
    if (!_listening.isClosed) _listening.add(value && _shouldListen);
  }

  Future<void> dispose() async {
    _disposed = true;
    await _stopListening();
    await _listening.close();
  }
}
