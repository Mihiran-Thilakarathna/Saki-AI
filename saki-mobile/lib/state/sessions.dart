import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import 'core_providers.dart';
import 'settings.dart';

class SessionsNotifier extends AsyncNotifier<List<SessionSummary>> {
  @override
  Future<List<SessionSummary>> build() async {
    final token = ref.watch(authProvider.select((auth) => auth.value?.token));
    if (token == null) return const [];
    return ref.read(apiClientProvider).listSessions();
  }

  Future<void> refresh() async {
    final sessions = await ref.read(apiClientProvider).listSessions();
    if (ref.mounted) state = AsyncData(sessions);
  }

  Future<SessionSummary> create({String? title}) async {
    final session = await ref.read(apiClientProvider).createSession(title: title);
    state = AsyncData([session, ...state.value ?? const []]);
    await ref.read(settingsProvider.notifier).selectSession(session.id);
    return session;
  }

  /// Moves a session to the top after activity (the backend orders by updatedAt).
  void touch(String sessionId, DateTime updatedAt) {
    final sessions = [...state.value ?? const <SessionSummary>[]];
    final index = sessions.indexWhere((s) => s.id == sessionId);
    if (index < 0) return;
    final session = sessions.removeAt(index).copyWith(updatedAt: updatedAt);
    state = AsyncData([session, ...sessions]);
  }
}

final sessionsProvider = AsyncNotifierProvider<SessionsNotifier, List<SessionSummary>>(SessionsNotifier.new);

/// The paired / active session: the last one the user picked, if it still exists.
final selectedSessionProvider = Provider<SessionSummary?>((ref) {
  final id = ref.watch(settingsProvider.select((s) => s.lastSessionId));
  final sessions = ref.watch(sessionsProvider).value;
  if (id == null || sessions == null) return null;
  for (final session in sessions) {
    if (session.id == id) return session;
  }
  return null;
});
