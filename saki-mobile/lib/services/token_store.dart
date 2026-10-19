import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/models.dart';

/// Persists the JWT session in the platform keystore (Keychain / Android Keystore).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'saki_auth_session';
  final FlutterSecureStorage _storage;

  Future<AuthSession?> read() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null) return null;
      final session = AuthSession.fromJson(jsonDecode(raw) as Json);
      if (session.isExpired) {
        await clear();
        return null;
      }
      return session;
    } catch (_) {
      // Corrupt or unreadable entry (e.g. keystore reset after reinstall): start fresh.
      await clear();
      return null;
    }
  }

  Future<void> write(AuthSession session) => _storage.write(key: _key, value: jsonEncode(session.toJson()));

  Future<void> clear() async {
    try {
      await _storage.delete(key: _key);
    } catch (_) {
      // Nothing stored or keystore unavailable.
    }
  }
}
