import 'package:flutter/foundation.dart';

/// Compile-time override: `flutter run --dart-define=SAKI_API_URL=http://192.168.1.20:8080`
const String _configuredServerUrl = String.fromEnvironment('SAKI_API_URL');

/// Sensible default per target. A physical phone must use the laptop's LAN IP,
/// which the user can set on the login screen ("Server settings").
String defaultServerUrl() {
  if (_configuredServerUrl.isNotEmpty) return normalizeServerUrl(_configuredServerUrl);
  if (kIsWeb) return 'http://localhost:8080';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:8080'; // Android emulator -> host
  return 'http://localhost:8080';
}

String normalizeServerUrl(String raw) {
  var url = raw.trim();
  if (url.isEmpty) return url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://$url';
  while (url.endsWith('/')) {
    url = url.substring(0, url.length - 1);
  }
  return url;
}

/// STOMP endpoint derived from the REST base URL (matches the backend's `/ws`).
String webSocketUrlFor(String serverUrl) => '${serverUrl.replaceFirst(RegExp('^http'), 'ws')}/ws';

class AudioSettings {
  static const int sampleRate = 16000;
  static const int channels = 1;
  static const Duration maxRecording = Duration(seconds: 60);
  static const Duration minRecording = Duration(milliseconds: 500);
}
