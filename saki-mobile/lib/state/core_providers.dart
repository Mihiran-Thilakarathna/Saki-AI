import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../models/models.dart';
import '../services/google_auth.dart';
import '../services/saki_audio_player.dart';
import '../services/stomp_sync.dart';
import '../services/token_store.dart';
import 'settings.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final googleAuthProvider = Provider<GoogleAuth>((ref) => GoogleAuth());

/// Google web client ID when this device and the current server both support Google sign-in.
final googleClientIdProvider = FutureProvider<String?>((ref) async {
  if (!GoogleAuth.isSupportedPlatform) return null;
  try {
    return await ref.watch(apiClientProvider).googleClientId();
  } on ApiException {
    return null; // Server unreachable or older backend: just hide the button.
  }
});

// ------------------------------------------------------------------ auth

class AuthNotifier extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() => ref.read(tokenStoreProvider).read();

  Future<void> login(String email, String password) async {
    final session = await ref.read(apiClientProvider).login(email.trim(), password);
    await _store(session);
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    required String preferredLanguage,
  }) async {
    final session = await ref.read(apiClientProvider).register(
          fullName: fullName.trim(),
          email: email.trim(),
          password: password,
          preferredLanguage: preferredLanguage,
        );
    await _store(session);
  }

  /// Returns false when the user closed the Google account picker.
  Future<bool> loginWithGoogle({required String preferredLanguage}) async {
    final clientId = await ref.read(googleClientIdProvider.future);
    if (clientId == null) {
      throw const ApiException(0, 'GOOGLE_SIGN_IN_DISABLED', 'Google sign-in is not enabled on this server.');
    }
    final idToken = await ref.read(googleAuthProvider).signIn(clientId);
    if (idToken == null) return false;
    final session = await ref.read(apiClientProvider).loginWithGoogle(idToken, preferredLanguage: preferredLanguage);
    await _store(session);
    return true;
  }

  Future<void> _store(AuthSession session) async {
    await ref.read(tokenStoreProvider).write(session);
    state = AsyncData(session);
  }

  Future<void> logout() async {
    if (state.value == null) return;
    await ref.read(tokenStoreProvider).clear();
    await ref.read(googleAuthProvider).signOut();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthSession?>(AuthNotifier.new);

// ------------------------------------------------------------------ REST

final apiClientProvider = Provider<ApiClient>((ref) {
  final serverUrl = ref.watch(settingsProvider.select((s) => s.serverUrl));
  return ApiClient(
    baseUrl: serverUrl,
    tokenProvider: () => ref.read(authProvider).value?.token,
    onUnauthorized: () => ref.read(authProvider.notifier).logout(),
  );
});

// ------------------------------------------------------------------ realtime sync

final stompSyncProvider = Provider<StompSync?>((ref) {
  final token = ref.watch(authProvider.select((auth) => auth.value?.token));
  final serverUrl = ref.watch(settingsProvider.select((s) => s.serverUrl));
  if (token == null) return null;
  final sync = StompSync(wsUrl: webSocketUrlFor(serverUrl), token: token)..connect();
  ref.onDispose(sync.dispose);
  return sync;
});

final syncStatusProvider = StreamProvider<SyncStatus>((ref) async* {
  final sync = ref.watch(stompSyncProvider);
  if (sync == null) {
    yield SyncStatus.disconnected;
    return;
  }
  yield sync.currentStatus;
  yield* sync.status;
});

// ------------------------------------------------------------------ audio

final audioPlayerProvider = Provider<SakiAudioPlayer>((ref) {
  final player = SakiAudioPlayer();
  ref.onDispose(player.dispose);
  return player;
});

final speakingProvider = StreamProvider<bool>((ref) async* {
  final player = ref.watch(audioPlayerProvider);
  yield player.isSpeaking;
  yield* player.speaking;
});
