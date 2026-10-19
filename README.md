# Saki AI — Your Bilingual Coding Companion

Talk to **Saki** in **සිංහල, English or Singlish** ("Spring Boot වල JWT auth හදන්නේ කොහොමද?"). Saki answers out loud
with a natural neural voice and writes the full code straight into your editor.

**Single brain, dual client:** one Spring Boot backend, a React + Monaco **Web IDE**, and a Flutter **mobile app** that
works on its own or as a **wireless microphone** for the Web IDE. Everything stays in sync over WebSockets.

```text
 Flutter app (phone) ──┐  voice / text            ┌──► Gemini 3.8 Flash (multimodal: hears Sinhala + English)
                       ├──► Spring Boot backend ───┤
 Web IDE (laptop) ─────┘  REST + STOMP /ws         └──► Gemini TTS (Azure / Google fallback), si-LK + en-US ──► MP3
                               │
                               ├──► PostgreSQL 16 (users, sessions, conversation history, live code)
                               └──► /topic/session/{id}  ──► both clients update in real time
```

| Folder | Stack |
| --- | --- |
| [`saki-backend/`](saki-backend) | Java 21, Spring Boot 3.5, Spring Security + JWT, JPA + Flyway, STOMP WebSocket, virtual threads |
| [`saki-web/`](saki-web) | React 19, TypeScript, Vite, Tailwind CSS 4, Monaco Editor, `@stomp/stompjs`, Zustand |
| [`saki-mobile/`](saki-mobile) | Flutter 3.38 / Dart 3.10, Riverpod 3, `record`, `just_audio`, `speech_to_text`, `stomp_dart_client`, `dio` |
| [`docker-compose.yml`](docker-compose.yml) | PostgreSQL 16 + backend + Web IDE (nginx) |

> **Live demo:** <https://saki-ai-blue.vercel.app> (free hosting: the first visit after a quiet period can take
> about a minute while the server wakes up).
>
> **Deploy online for free** (Vercel + Render + Neon, no credit card): see **[DEPLOY.md](DEPLOY.md)**.

---

## 1. Get your API keys

Saki needs **only one key: Gemini.** The same key powers Saki's brain *and* voice (Gemini TTS speaks Sinhala and
Singlish naturally). **Azure** and **Google** TTS are optional fallbacks. If no voice provider works, Saki still answers in
text, and the Web IDE falls back to the browser's own voice when it has one.

### Google Gemini (required)
1. Open **[Google AI Studio → API keys](https://aistudio.google.com/apikey)** and sign in.
2. Click **Create API key** (pick or create a Google Cloud project).
3. Put it in `.env` as `GEMINI_API_KEY`. The default model is `gemini-3.8-flash` (`GEMINI_MODEL`). Google retires older
   models for new keys (e.g. `gemini-2.5-flash` returns 404), so if Saki reports `AI_MODEL_UNAVAILABLE`, set
   `GEMINI_MODEL` to a current model from [the models list](https://ai.google.dev/gemini-api/docs/models).

### Saki's voice (Gemini TTS, default, no extra setup)
Uses `GEMINI_API_KEY` with `gemini-3.8-flash-tts`. Change the voice with `GEMINI_TTS_SINHALA_VOICE` /
`GEMINI_TTS_ENGLISH_VOICE`: `Charon` (default), `Orus`, `Puck` (male) or `Kore`, `Aoede`, `Leda` (female). The audio is
re-encoded to MP3 on the server, so clients play the same format from every provider.

### Microsoft Azure AI Speech (optional fallback)
1. In the **[Azure portal](https://portal.azure.com)** choose **Create a resource → Speech** (part of Azure AI services).
2. Choose a **region** (e.g. `southeastasia`, `eastus`) and a pricing tier. The free **F0** tier includes a monthly
   neural-TTS allowance.
3. Open the resource → **Keys and Endpoint**. Copy **KEY 1** into `AZURE_SPEECH_KEY` and the **Location/Region** into
   `AZURE_SPEECH_REGION`.
4. Voices: `si-LK-SameeraNeural` (male, default) / `si-LK-ThiliniNeural` (female), and `en-US-AvaNeural` / `en-US-AndrewNeural`.
   You can try them in **[Speech Studio → Voice Gallery](https://speech.microsoft.com/portal/voicegallery)**.

### Google Cloud Text-to-Speech (optional fallback)
1. In the **[Google Cloud console](https://console.cloud.google.com/)** enable **Cloud Text-to-Speech API**.
2. **APIs & Services → Credentials → Create credentials → API key**; restrict it to the Text-to-Speech API.
3. Set `GOOGLE_TTS_API_KEY`. English works out of the box. Sinhala is only used if you set `GOOGLE_SINHALA_VOICE` to a
   voice your project can use (check the [voice list](https://cloud.google.com/text-to-speech/docs/voices)).

### Sign in with Google (optional)
One **Web application** OAuth client serves the Web IDE and the Android app.
1. **[Google Cloud console](https://console.cloud.google.com/) → APIs & Services → OAuth consent screen**: choose
   **External**, fill in the app name (Saki AI) and your email, and add yourself as a **test user** while the app is in
   *Testing*.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized JavaScript origins** add
   `http://localhost:5173` and `http://localhost:8081` (plus any real domain). Copy the client ID into `GOOGLE_CLIENT_ID`.
3. For the **Android app**, also create an **OAuth client ID → Android** with package name `com.sakiai.saki_mobile` and
   the SHA-1 of the keystore that signs the APK. For debug builds:
   ```bash
   keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
   ```
   No client ID goes into the app: it reads `GOOGLE_CLIENT_ID` from the backend (`GET /api/v1/auth/providers`).

The backend verifies each Google ID token (signature, issuer, audience = `GOOGLE_CLIENT_ID`, verified email). A first
Google sign-in creates an account; if a Saki account with the same email exists, Google is linked to it and the password
keeps working. When `GOOGLE_CLIENT_ID` is blank the Google buttons are simply hidden.

### JWT secret
```bash
openssl rand -base64 48
```
Put the output in `JWT_SECRET` (must decode to at least 32 bytes).

---

## 2. Run everything with Docker (easiest)

Requires Docker Desktop (or Docker Engine + Compose v2).

```bash
cp .env.example .env
```
Edit `.env`: set `POSTGRES_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`, and `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`.

```bash
docker compose up -d --build
```

| Service | URL |
| --- | --- |
| Web IDE | http://localhost:8081 |
| Backend API | http://localhost:8080 (health: `/actuator/health`) |
| PostgreSQL | `localhost:5432` (bound to 127.0.0.1 only) |

Open the Web IDE, create an account, click the mic (or press **Alt+S**) and ask a question. The database schema is created
automatically by Flyway on first start.

```bash
docker compose logs -f backend
```
```bash
docker compose down
```
(`docker compose down -v` also deletes the database volume.)

---

## 3. Local development (without Docker)

### Backend — `saki-backend`
Needs JDK 21+ and Maven 3.9+, plus a PostgreSQL 16 database. You can run just the database from Compose:

```bash
docker compose up -d postgres
```

Set the environment variables from `.env.example` (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`,
`GEMINI_API_KEY`, `AZURE_SPEECH_KEY`, …), then:

```bash
cd saki-backend
mvn spring-boot:run
```

Tests (unit tests, full-context tests on H2, and the Flyway schema on a real embedded PostgreSQL 16; no keys or Docker
needed, the Postgres binaries are fetched from Maven on the first run):
```bash
mvn test
```

### Web IDE — `saki-web`
Needs Node 22+. The Vite dev server proxies `/api` and `/ws` to `http://localhost:8080` (change with `SAKI_BACKEND_URL`).

```bash
cd saki-web
npm install
npm run dev
```
Open http://localhost:5173. Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

### Mobile app — `saki-mobile`
Needs Flutter 3.38+ and, for Android, the Android SDK (platform 36 and NDK 27.x).

```bash
cd saki-mobile
flutter pub get
flutter run
```

**Which server address?** The login screen has **Server settings**:

| Where the app runs | Backend URL |
| --- | --- |
| Android emulator | `http://10.0.2.2:8080` (default) |
| iOS simulator / web | `http://localhost:8080` |
| Real phone | `http://<your-laptop-Wi-Fi-IP>:8080`, e.g. `http://192.168.1.20:8080` |

You can also bake it in at build time: `flutter run --dart-define=SAKI_API_URL=http://192.168.1.20:8080`.
Find your laptop IP with `ipconfig` (Windows) or `ipconfig getifaddr en0` (macOS), and allow port **8080** through the
firewall. Phone and laptop must be on the same Wi-Fi.

Build an APK:
```bash
flutter build apk --release
```

---

## 4. Using Saki

### Web IDE
- **Mic:** click to start/stop, **hold** for push-to-talk, **Alt+S** from anywhere, **Esc** cancels.
- **"Hey Saki" hands-free:** toggle the ear button. Uses the browser's Web Speech API (Chrome/Edge). Recording then stops
  automatically when you pause.
- Code from Saki lands in Monaco (undo with Ctrl+Z). Manual edits are saved to the session and sent as context with your
  next question. Copy/download from the editor toolbar; replay or stop Saki's voice from the chat.

### Mobile app
- **Standalone:** ask on the phone, hear the answer, read highlighted code (tap a code card for full screen, copy).
- **Web IDE mic (companion):** log in with the **same account**, pick the session that is open on your laptop (the most
  recent one is at the top), and talk. The code appears in the laptop's editor and the laptop speaks the answer.
  Turn on *Speak answers on phone in companion mode* in Settings if you also want audio on the phone.
- **"Hey Saki"** uses the phone's speech recognizer while the app is open.

Each client sends a per-device `clientId`; the backend echoes it as `originClientId`, so the asking device ignores its own
WebSocket echo while every other device updates.

---

## 5. API reference

All endpoints except register/login need `Authorization: Bearer <token>`. Errors are RFC 9457 `ProblemDetail` JSON with an
`errorCode` (e.g. `AI_NOT_CONFIGURED`, `UNSUPPORTED_AUDIO_FORMAT`, `EMAIL_IN_USE`).

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | `{fullName, email, password, preferredLanguage: "si-LK" \| "en-US"}` |
| POST | `/api/v1/auth/login` | `{email, password}` → `{accessToken, tokenType, expiresIn, user}` |
| POST | `/api/v1/auth/google` | `{idToken, preferredLanguage?}` (Google ID token) → same as login |
| GET | `/api/v1/auth/providers` | Public: `{googleEnabled, googleClientId}` |
| GET | `/api/v1/auth/me` | Current profile |
| GET / POST | `/api/v1/sessions` | List / create coding sessions |
| GET / PATCH / DELETE | `/api/v1/sessions/{id}` | Read, rename / save editor code, delete |
| GET | `/api/v1/sessions/{id}/messages` | Full conversation + code history |
| POST | `/api/v1/saki/voice-query` | multipart: `audioFile`, `sessionId`, optional `currentEditorCode`, `programmingLanguage`, `clientId` |
| POST | `/api/v1/saki/text-query` | JSON: `{sessionId, query, currentEditorCode?, programmingLanguage?, clientId?}` |

Accepted audio: webm/opus (browsers), wav (Flutter app), mp3, aac/m4a, ogg, flac — up to 15 MB.

**WebSocket (STOMP):** connect to `/ws` (native) or `/ws/sockjs` with header `Authorization: Bearer <token>`.
- `/topic/session/{sessionId}` — every Saki answer (`SakiResponseDto`)
- `/topic/session/{sessionId}/events` — `PROCESSING` / `COMPLETED` / `FAILED` ("Saki is thinking…")
- `/topic/session/{sessionId}/audio` — Saki's voice for an answer sent with `audioPending: true`
  (`{sessionId, messageId, audioBase64, audioMimeType, originClientId}`; `audioBase64` is null if TTS failed)

By default (`TTS_ASYNC_AUDIO=true`) the HTTP response carries the text and code as soon as Gemini answers, with
`audioBase64: null, audioPending: true`; the MP3 follows on the audio topic a few seconds later. Set
`TTS_ASYNC_AUDIO=false` to get the audio inside the HTTP response instead.

Subscriptions are only allowed for sessions you own.

**Response shape (`SakiResponseDto`):**
```json
{
  "sessionId": "…", "messageId": "…",
  "userTranscript": "Hey Saki, Spring Boot වල JWT auth හදන්නේ කොහොමද?",
  "detectedLanguage": "si-LK",
  "spokenResponse": "හරි යාළුවා! … editor එකේ බලන්න.",
  "audioBase64": "<MP3>", "audioMimeType": "audio/mpeg",
  "codePayload": { "hasCode": true, "programmingLanguage": "java", "fileName": "JwtAuthenticationFilter.java",
                   "code": "…", "explanationMarkdown": "- …" },
  "timestamp": "2026-10-18T12:00:00Z", "originClientId": "web-…"
}
```

---

## 6. Troubleshooting

| Problem | Fix |
| --- | --- |
| `AI_NOT_CONFIGURED` (503) | Set `GEMINI_API_KEY` and restart the backend. |
| Google button missing | `GOOGLE_CLIENT_ID` is blank, or the backend was not restarted after setting it. |
| Google popup: "origin is not allowed" / `idpiframe_initialization_failed` | Add the exact Web IDE URL (e.g. `http://localhost:5173`) to **Authorized JavaScript origins**; changes can take a few minutes. |
| Android: "Google sign-in is not set up for this app build" | Create the **Android** OAuth client with package `com.sakiai.saki_mobile` and the SHA-1 of the signing keystore. |
| "Saki has used up its Gemini API quota" (`AI_QUOTA_EXCEEDED`) | The free-tier daily quota of your Gemini key is used up. It resets daily; for heavier use enable billing on the key in Google AI Studio. |
| "Saki's AI service is busy right now" | Google's model is under heavy demand. Saki already tries `GEMINI_FALLBACK_MODELS`; wait a moment and ask again. |
| `AI_MODEL_UNAVAILABLE` (503) | Google retired that model for your key; set `GEMINI_MODEL` to a current one (e.g. `gemini-3.8-flash`). |
| Answers but no voice | The backend log says which TTS provider failed (`TTS provider gemini failed …`). Check `GEMINI_TTS_MODEL` is still offered to your key, or add an Azure key as fallback. |
| Web IDE mic does nothing on another PC | Browsers only allow the mic on `https://` or `localhost`. Use the phone app, or put the Web IDE behind HTTPS. |
| "Hey Saki" toggle disabled (web) | Needs Chrome or Edge (Web Speech API). Push-to-talk works everywhere. |
| Phone: "Cannot reach the Saki backend" | Use the laptop's Wi-Fi IP (not `localhost`), same network, firewall open for 8080. |
| Phone answers don't appear on the laptop | Same account and same session on both; check the "Paired · live" indicator. |
| Android build: `NDK not configured` / missing `android-35` | `android/build.gradle.kts` aligns plugins to NDK `27.1.12297006` and compileSdk 36. Install those via Android Studio → SDK Manager, or edit the versions there to match what you have. |
