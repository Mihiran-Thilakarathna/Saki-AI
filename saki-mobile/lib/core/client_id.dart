import 'package:uuid/uuid.dart';

/// Per-app-launch identifier sent as `clientId`. The backend echoes it as
/// `originClientId`, so this device can ignore the WebSocket echo of its own query.
final String clientId = 'mobile-${const Uuid().v4()}';
