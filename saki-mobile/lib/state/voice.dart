import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/voice_recorder.dart';
import '../services/wake_word_listener.dart';
import 'conversation.dart';
import 'core_providers.dart';
import 'settings.dart';

class VoiceState {
  const VoiceState({
    this.recording = false,
    this.handsFree = false,
    this.wakeListening = false,
    this.wakeAvailable = true,
    this.notice,
    this.noticeSeq = 0,
  });

  final bool recording;

  /// Recording was started by "Hey Saki" and will stop on its own when the user pauses.
  final bool handsFree;
  final bool wakeListening;
  final bool wakeAvailable;
  final String? notice;
  final int noticeSeq;

  VoiceState copyWith({
    bool? recording,
    bool? handsFree,
    bool? wakeListening,
    bool? wakeAvailable,
    String? notice,
  }) =>
      VoiceState(
        recording: recording ?? this.recording,
        handsFree: handsFree ?? this.handsFree,
        wakeListening: wakeListening ?? this.wakeListening,
        wakeAvailable: wakeAvailable ?? this.wakeAvailable,
        notice: notice ?? this.notice,
        noticeSeq: notice != null ? noticeSeq + 1 : noticeSeq,
      );
}

/// Orchestrates the phone's voice loop: tap-to-toggle / hold-to-talk recording,
/// the "Hey Saki" hands-free trigger, barge-in, and handing audio to the conversation.
class VoiceController extends Notifier<VoiceState> {
  late final VoiceRecorder _recorder;
  late final WakeWordListener _wake;

  Stream<double> get levels => _recorder.levels;

  @override
  VoiceState build() {
    _recorder = VoiceRecorder();
    _wake = WakeWordListener(onWake: _onWake, onFatalError: _onWakeFatal);
    final wakeSub = _wake.listening.listen((listening) {
      if (ref.mounted) state = state.copyWith(wakeListening: listening);
    });
    ref.onDispose(() {
      unawaited(wakeSub.cancel());
      unawaited(_recorder.dispose());
      unawaited(_wake.dispose());
    });

    // Keep the wake-word listener off the mic whenever Saki is busy or talking.
    ref.listen(conversationProvider.select((c) => c.thinking), (_, _) => _syncWake());
    ref.listen(speakingProvider.select((s) => s.value ?? false), (_, _) => _syncWake());
    ref.listen(conversationProvider.select((c) => c.sessionId), (_, _) => _syncWake());

    if (ref.read(settingsProvider).wakeWordEnabled) {
      Future.microtask(() => _setWakeEnabled(true, persist: false));
    }
    return const VoiceState();
  }

  bool get _busy {
    final conversation = ref.read(conversationProvider);
    final speaking = ref.read(speakingProvider).value ?? false;
    return state.recording || conversation.thinking || speaking || conversation.sessionId == null;
  }

  void _syncWake() {
    if (!ref.mounted || !ref.read(settingsProvider).wakeWordEnabled) return;
    if (_busy) {
      unawaited(_wake.pause());
    } else {
      _wake.resume();
    }
  }

  Future<void> toggle() => state.recording ? stopAndSend() : start();

  Future<void> start({bool handsFree = false}) async {
    if (state.recording || ref.read(conversationProvider).thinking) return;
    if (ref.read(conversationProvider).sessionId == null) {
      state = state.copyWith(notice: 'Pick or pair a session first.');
      return;
    }
    await ref.read(audioPlayerProvider).stop(); // Barge-in.
    await _wake.pause();
    try {
      await _recorder.start(onAutoStop: handsFree ? _onAutoStop : null);
      unawaited(HapticFeedback.mediumImpact());
      state = state.copyWith(recording: true, handsFree: handsFree);
    } on RecorderException catch (e) {
      state = state.copyWith(notice: e.message);
      _syncWake();
    }
  }

  Future<void> stopAndSend() async {
    if (!state.recording) return;
    final wav = await _recorder.stop();
    unawaited(HapticFeedback.lightImpact());
    state = state.copyWith(recording: false, handsFree: false);
    if (wav == null) {
      state = state.copyWith(notice: 'That was too short — hold the mic a little longer.');
      _syncWake();
      return;
    }
    await ref.read(conversationProvider.notifier).sendVoice(wav);
    _syncWake();
  }

  Future<void> cancel() async {
    if (!state.recording) return;
    await _recorder.cancel();
    state = state.copyWith(recording: false, handsFree: false);
    _syncWake();
  }

  void _onAutoStop(AutoStopReason reason) {
    if (reason == AutoStopReason.noSpeech) {
      unawaited(cancel());
    } else {
      unawaited(stopAndSend());
    }
  }

  void _onWake() {
    unawaited(HapticFeedback.heavyImpact());
    unawaited(start(handsFree: true));
  }

  void _onWakeFatal(String message) {
    unawaited(ref.read(settingsProvider.notifier).setWakeWordEnabled(false));
    state = state.copyWith(notice: message, wakeAvailable: false);
  }

  Future<void> toggleWakeWord() => _setWakeEnabled(!ref.read(settingsProvider).wakeWordEnabled);

  Future<void> _setWakeEnabled(bool enabled, {bool persist = true}) async {
    if (enabled) {
      final ok = await _wake.enable();
      if (!ok) {
        state = state.copyWith(
          wakeAvailable: false,
          notice: 'Speech recognition is not available on this device, so "Hey Saki" is off.',
        );
        await ref.read(settingsProvider.notifier).setWakeWordEnabled(false);
        return;
      }
      if (persist) await ref.read(settingsProvider.notifier).setWakeWordEnabled(true);
      _syncWake();
    } else {
      await _wake.disable();
      if (persist) await ref.read(settingsProvider.notifier).setWakeWordEnabled(false);
    }
  }
}

final voiceControllerProvider = NotifierProvider<VoiceController, VoiceState>(VoiceController.new);
