import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Native "Sign in with Google" (Android Credential Manager / iOS). Returns a Google ID
/// token whose audience is the backend's web client ID ([serverClientId]), which
/// saki-backend verifies at /api/v1/auth/google.
class GoogleAuth {
  String? _initializedFor;

  /// Google sign-in on Flutter web needs Google's rendered button; the Web IDE covers web.
  static bool get isSupportedPlatform =>
      !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

  /// Shows the Google account picker. Returns null when the user cancels.
  Future<String?> signIn(String serverClientId) async {
    final google = GoogleSignIn.instance;
    if (_initializedFor != serverClientId) {
      await google.initialize(serverClientId: serverClientId);
      _initializedFor = serverClientId;
    }
    if (!google.supportsAuthenticate()) {
      throw const GoogleAuthFailure('Google sign-in is not supported on this device.');
    }
    try {
      final account = await google.authenticate(scopeHint: const ['email', 'profile']);
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const GoogleAuthFailure('Google did not return a sign-in token.');
      }
      return idToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      throw GoogleAuthFailure(_describe(e));
    }
  }

  /// Lets the next sign-in show the account picker again. Never throws.
  Future<void> signOut() async {
    if (_initializedFor == null) return;
    try {
      await GoogleSignIn.instance.signOut();
    } on Object {
      // Best effort: the Saki session is already cleared.
    }
  }

  static String _describe(GoogleSignInException e) {
    final detail = e.description ?? e.code.name;
    // Most often a missing Android OAuth client (package name + SHA-1) in Google Cloud.
    if (e.code == GoogleSignInExceptionCode.clientConfigurationError ||
        e.code == GoogleSignInExceptionCode.providerConfigurationError) {
      return 'Google sign-in is not set up for this app build ($detail). '
          'Add an Android OAuth client with this app\'s package name and SHA-1.';
    }
    return 'Google sign-in failed: $detail';
  }
}

class GoogleAuthFailure implements Exception {
  const GoogleAuthFailure(this.message);

  final String message;

  @override
  String toString() => message;
}
