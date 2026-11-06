<div align="center">

<img src="docs/saki-logo.png" alt="Saki AI logo" width="150" />

# Saki AI

### Your AI coding assistant, fluent in Sinhala and English

Ask in **සිංහල, English or Singlish**. Saki explains the answer **out loud** and writes the **complete code** into your editor.

<a href="https://saki-ai-blue.vercel.app"><img src="https://img.shields.io/badge/Live_demo-saki--ai--blue.vercel.app-22c8f5?style=for-the-badge&logo=vercel&logoColor=white" alt="Live demo" /></a>

![Java](https://img.shields.io/badge/Java_21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.5-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

</div>

> [!NOTE]
> The live demo runs on free hosting, so the first request after a quiet period can take about a minute.

## ✨ Features

- 🎙️ **Voice or text** in Sinhala, English or Singlish: click the mic, press **Alt+S**, or say **"Hey Saki"**.
- 🔊 **Spoken answers** in a natural voice: change the speed, download them as MP3, and replay them later, even after a
  reload or on another device.
- 💻 **Complete code in a Monaco editor** (the VS Code editor); Saki reads your code with every question.
- ⌨️ **Answers type themselves out**, followed by the key points, the voice and the code file.
- 📱 **Phone as a wireless mic**: the Flutter app pairs with the Web IDE and stays in sync in real time.
- 🎨 **Light, dark or match your device**, with a smooth switch between them, and five chat themes.
- ⚙️ **Settings** for your profile, voice and chat history (search, export, clear).
- 🔐 **Sign in** with email or Google; every visit starts on a fresh chat.

## 🧱 Tech stack

| Part | Built with |
| --- | --- |
| [`saki-backend`](saki-backend) | Java 21, Spring Boot 3.5, Spring Security + JWT, PostgreSQL + Flyway, STOMP WebSocket |
| [`saki-web`](saki-web) | React 19, TypeScript, Vite, Tailwind CSS 4, Monaco Editor, Zustand |
| [`saki-mobile`](saki-mobile) | Flutter, Riverpod, `record`, `just_audio`, `stomp_dart_client` |
| AI | Google **Gemini** for understanding speech and answering, **Gemini TTS** for the voice (with a backup voice model) |

**How it works:** the question (voice or text) and the code in the editor go to the backend. Gemini understands the
question and returns a spoken answer, key points and a complete code file. The answer appears at once, the voice follows
a few seconds later and is saved with the chat, and every device on the same account updates in real time.

## 🚀 Run it locally

**1. Get a Gemini API key** (free) from [Google AI Studio](https://aistudio.google.com/apikey). It is the only key you
need.

**2. Create the `.env` file:**

```bash
cp .env.example .env
```

Fill in `GEMINI_API_KEY`, `POSTGRES_PASSWORD` and `JWT_SECRET` (make one with `openssl rand -base64 48`).
For **Sign in with Google**, also set `GOOGLE_CLIENT_ID` from a Google Cloud OAuth *Web application* client.

**3. Start everything with Docker:**

```bash
docker compose up -d --build
```

Open **http://localhost:8081**, create an account and ask Saki a question.

<details>
<summary><b>Run without Docker</b></summary>

**Backend** (JDK 21, Maven, PostgreSQL 16; set the variables from `.env.example`):

```bash
cd saki-backend
mvn spring-boot:run
```

**Web IDE** (Node 22):

```bash
cd saki-web
npm install
npm run dev
```

Open http://localhost:5173.

**Mobile app** (Flutter 3.38). Set the backend address under **Server settings** on the login screen:

```bash
cd saki-mobile
flutter pub get
flutter run
```

</details>

## ☁️ Deployment

The live version runs entirely on free plans:

| Part | Host |
| --- | --- |
| Web IDE | **Vercel** (root directory `saki-web`, `VITE_API_BASE_URL` = backend URL) |
| Backend | **Render** with Docker, set up from [`render.yaml`](render.yaml) |
| Database | **Neon** PostgreSQL |

Set the backend's `CORS_ALLOWED_ORIGINS` to the Web IDE's URL, and add that URL to the Google client's
**Authorized JavaScript origins**.

## 🔒 Security

- Passwords are hashed with BCrypt, and every chat, message and voice is only visible to its owner.
- Rate limits protect sign-in and the AI from abuse, and large requests are refused.
- A strict Content-Security-Policy and secure browser headers are set on the website.
- Secrets live only in `.env` (git-ignored) or the hosting dashboards.

See the [Privacy Policy](https://saki-ai-blue.vercel.app/privacy) and
[Terms of Service](https://saki-ai-blue.vercel.app/terms).

<div align="center">

<br />

Made in Sri Lanka 🇱🇰 · **[Try Saki AI →](https://saki-ai-blue.vercel.app)**

</div>
