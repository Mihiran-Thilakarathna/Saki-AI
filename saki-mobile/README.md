# saki-mobile

Flutter app for **Saki AI**: ask coding questions in Sinhala or English on the phone (**Standalone**), or use the
phone as a wireless microphone for the Web IDE (**Web IDE mic** / companion mode).

```bash
flutter pub get
flutter run
```

Set the backend address on the login screen (**Server settings**) or with
`--dart-define=SAKI_API_URL=http://<laptop-ip>:8080`. See the [root README](../README.md) for keys, pairing and
troubleshooting.

```text
lib/
  core/      config, REST client (dio), WAV encoding, wake-word matcher, language mapping
  models/    DTO mirrors of saki-backend
  services/  STOMP sync, PCM recorder with voice-activity auto-stop, MP3 player, "Hey Saki" listener
  state/     Riverpod: settings, auth, sessions, conversation, voice controller
  ui/        theme, screens (login, home, session picker, settings, code viewer), widgets
```

```bash
flutter analyze
flutter test
```
