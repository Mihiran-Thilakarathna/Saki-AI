import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/config.dart';

/// Overridden in `main()` with the loaded instance.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPreferencesProvider must be overridden'),
);

enum SakiMode {
  /// Ask Saki on the phone; answers are spoken and shown here.
  standalone,

  /// The phone is a wireless mic for the Web IDE; code lands on the laptop.
  companion,
}

class AppSettings {
  const AppSettings({
    required this.serverUrl,
    required this.mode,
    required this.playAudioInCompanion,
    required this.wakeWordEnabled,
    required this.muted,
    required this.lastSessionId,
  });

  final String serverUrl;
  final SakiMode mode;
  final bool playAudioInCompanion;
  final bool wakeWordEnabled;
  final bool muted;
  final String? lastSessionId;

  bool get isCompanion => mode == SakiMode.companion;

  /// Whether Saki's voice should play on this phone for answers in the current mode.
  bool get speaksOnPhone => !muted && (!isCompanion || playAudioInCompanion);

  AppSettings copyWith({
    String? serverUrl,
    SakiMode? mode,
    bool? playAudioInCompanion,
    bool? wakeWordEnabled,
    bool? muted,
    String? lastSessionId,
    bool clearLastSession = false,
  }) =>
      AppSettings(
        serverUrl: serverUrl ?? this.serverUrl,
        mode: mode ?? this.mode,
        playAudioInCompanion: playAudioInCompanion ?? this.playAudioInCompanion,
        wakeWordEnabled: wakeWordEnabled ?? this.wakeWordEnabled,
        muted: muted ?? this.muted,
        lastSessionId: clearLastSession ? null : (lastSessionId ?? this.lastSessionId),
      );
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _serverUrl = 'server_url';
  static const _mode = 'mode';
  static const _playInCompanion = 'play_audio_in_companion';
  static const _wakeWord = 'wake_word_enabled';
  static const _muted = 'muted';
  static const _lastSession = 'last_session_id';

  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  AppSettings build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    return AppSettings(
      serverUrl: prefs.getString(_serverUrl) ?? defaultServerUrl(),
      mode: prefs.getString(_mode) == SakiMode.companion.name ? SakiMode.companion : SakiMode.standalone,
      playAudioInCompanion: prefs.getBool(_playInCompanion) ?? false,
      wakeWordEnabled: prefs.getBool(_wakeWord) ?? false,
      muted: prefs.getBool(_muted) ?? false,
      lastSessionId: prefs.getString(_lastSession),
    );
  }

  Future<void> setServerUrl(String url) async {
    final normalized = normalizeServerUrl(url);
    if (normalized.isEmpty || normalized == state.serverUrl) return;
    await _prefs.setString(_serverUrl, normalized);
    state = state.copyWith(serverUrl: normalized);
  }

  Future<void> setMode(SakiMode mode) async {
    await _prefs.setString(_mode, mode.name);
    state = state.copyWith(mode: mode);
  }

  Future<void> setPlayAudioInCompanion(bool value) async {
    await _prefs.setBool(_playInCompanion, value);
    state = state.copyWith(playAudioInCompanion: value);
  }

  Future<void> setWakeWordEnabled(bool value) async {
    await _prefs.setBool(_wakeWord, value);
    state = state.copyWith(wakeWordEnabled: value);
  }

  Future<void> toggleMuted() async {
    await _prefs.setBool(_muted, !state.muted);
    state = state.copyWith(muted: !state.muted);
  }

  Future<void> selectSession(String? sessionId) async {
    if (sessionId == null) {
      await _prefs.remove(_lastSession);
      state = state.copyWith(clearLastSession: true);
    } else {
      await _prefs.setString(_lastSession, sessionId);
      state = state.copyWith(lastSessionId: sessionId);
    }
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);
