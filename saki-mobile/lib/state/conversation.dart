import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/client_id.dart';
import '../models/models.dart';
import 'core_providers.dart';
import 'sessions.dart';
import 'settings.dart';

class ConversationState {
  const ConversationState({
    required this.sessionId,
    this.loading = false,
    this.messages = const [],
    this.thinking = false,
    this.remoteActivity = false,
    this.lastDelivery,
    this.notice,
    this.noticeSeq = 0,
  });

  final String? sessionId;
  final bool loading;
  final List<ChatEntry> messages;

  /// A query from this phone is in flight.
  final bool thinking;

  /// Another device (the Web IDE) is asking Saki right now.
  final bool remoteActivity;

  /// Companion mode: the last answer delivered to the laptop.
  final SakiResponse? lastDelivery;

  /// One-shot message for a SnackBar; [noticeSeq] changes for every new notice.
  final String? notice;
  final int noticeSeq;

  ConversationState copyWith({
    bool? loading,
    List<ChatEntry>? messages,
    bool? thinking,
    bool? remoteActivity,
    SakiResponse? lastDelivery,
    String? notice,
  }) =>
      ConversationState(
        sessionId: sessionId,
        loading: loading ?? this.loading,
        messages: messages ?? this.messages,
        thinking: thinking ?? this.thinking,
        remoteActivity: remoteActivity ?? this.remoteActivity,
        lastDelivery: lastDelivery ?? this.lastDelivery,
        notice: notice ?? this.notice,
        noticeSeq: notice != null ? noticeSeq + 1 : noticeSeq,
      );
}

/// Conversation for the selected session: history, live answers from this phone,
/// and answers / activity broadcast from the paired Web IDE.
class ConversationNotifier extends Notifier<ConversationState> {
  /// Answers shown here whose voice is still being synthesized on the server.
  final Set<String> _awaitingAudio = {};

  @override
  ConversationState build() {
    final sessionId = ref.watch(selectedSessionProvider.select((s) => s?.id));
    final sync = ref.watch(stompSyncProvider);
    sync?.watchSession(sessionId);

    if (sync != null) {
      final responses = sync.responses.listen(_onBroadcast);
      final events = sync.events.listen(_onEvent);
      final audio = sync.audio.listen(_onAudio);
      ref.onDispose(() {
        unawaited(responses.cancel());
        unawaited(events.cancel());
        unawaited(audio.cancel());
      });
    }
    if (sessionId == null) return const ConversationState(sessionId: null);
    Future.microtask(() => _loadHistory(sessionId));
    return ConversationState(sessionId: sessionId, loading: true);
  }

  Future<void> _loadHistory(String sessionId) async {
    try {
      final history = await ref.read(apiClientProvider).messages(sessionId);
      if (!ref.mounted || state.sessionId != sessionId) return;
      state = state.copyWith(loading: false, messages: ChatEntry.fromHistory(history));
    } on ApiException catch (e) {
      if (!ref.mounted || state.sessionId != sessionId) return;
      state = state.copyWith(loading: false, notice: e.displayMessage);
    }
  }

  Future<bool> sendVoice(Uint8List wavBytes) => _run(
        (api, sessionId) => api.voiceQuery(sessionId: sessionId, wavBytes: wavBytes, clientId: clientId),
      );

  Future<bool> sendText(String query) => _run(
        (api, sessionId) => api.textQuery(sessionId: sessionId, query: query.trim(), clientId: clientId),
      );

  Future<bool> _run(Future<SakiResponse> Function(ApiClient api, String sessionId) call) async {
    final sessionId = state.sessionId;
    if (sessionId == null) {
      state = state.copyWith(notice: 'Pick a session first.');
      return false;
    }
    if (state.thinking) return false;
    state = state.copyWith(thinking: true);
    try {
      final response = await call(ref.read(apiClientProvider), sessionId);
      if (!ref.mounted) return true;
      final firstExchange = state.messages.isEmpty;
      _apply(response, fromOtherDevice: false);
      state = state.copyWith(thinking: false, lastDelivery: response);
      await _speak(response);
      if (firstExchange) unawaited(ref.read(sessionsProvider.notifier).refresh()); // picks up the auto title
      return true;
    } on ApiException catch (e) {
      if (ref.mounted) state = state.copyWith(thinking: false, notice: e.displayMessage);
      return false;
    }
  }

  void _onBroadcast(SakiResponse response) {
    if (response.originClientId == clientId || response.sessionId != state.sessionId) return;
    state = state.copyWith(remoteActivity: false);
    if (_apply(response, fromOtherDevice: true) && !ref.read(settingsProvider).isCompanion) {
      // In companion mode the laptop speaks; in standalone mode the phone does.
      unawaited(_speak(response));
    }
  }

  void _onEvent(SessionEvent event) {
    if (event.originClientId == clientId || event.sessionId != state.sessionId) return;
    switch (event.type) {
      case SessionEventType.processing:
        state = state.copyWith(remoteActivity: true);
      case SessionEventType.completed:
        state = state.copyWith(remoteActivity: false);
      case SessionEventType.failed:
        state = state.copyWith(remoteActivity: false, notice: 'Web IDE query failed: ${event.message ?? 'unknown error'}');
    }
  }

  bool _apply(SakiResponse response, {required bool fromOtherDevice}) {
    if (state.messages.any((m) => m.id == response.messageId)) return false;
    state = state.copyWith(
      messages: [...state.messages, ...ChatEntry.fromResponse(response, fromOtherDevice: fromOtherDevice)],
    );
    ref.read(sessionsProvider.notifier).touch(response.sessionId, response.timestamp);
    return true;
  }

  void _onAudio(SakiAudio audio) {
    if (!_awaitingAudio.remove(audio.messageId)) return;
    final base64 = audio.audioBase64;
    if (base64 == null || !ref.mounted) return; // TTS failed: the answer text is already shown.
    final settings = ref.read(settingsProvider);
    unawaited(ref.read(audioPlayerProvider)
        .load(audio.messageId, base64, audio.audioMimeType, autoplay: settings.speaksOnPhone));
  }

  Future<void> _speak(SakiResponse response) async {
    final audio = response.audioBase64;
    if (audio == null) {
      if (response.audioPending) _awaitingAudio.add(response.messageId);
      return;
    }
    final settings = ref.read(settingsProvider);
    final player = ref.read(audioPlayerProvider);
    await player.load(response.messageId, audio, response.audioMimeType, autoplay: settings.speaksOnPhone);
  }
}

final conversationProvider = NotifierProvider<ConversationNotifier, ConversationState>(ConversationNotifier.new);
