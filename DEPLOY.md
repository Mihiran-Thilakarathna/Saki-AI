# Saki AI — නොමිලේ Deploy කරන ආකාරය (Rs. 0, credit card නැතුව)

```text
  Browser ──► Vercel (Web IDE, React)  ──HTTPS / WSS──►  Render (Spring Boot backend)  ──►  Neon (PostgreSQL)
                                                              │
  Phone app ──────────────────────────────────────────────────┘──►  Google Gemini (AI + voice)
```

| කොටස | Service | මිල |
| --- | --- | --- |
| Web IDE (`saki-web`) | [Vercel](https://vercel.com) Hobby | නොමිලේ |
| Backend (`saki-backend`) | [Render](https://render.com) Free web service | නොමිලේ |
| Database | [Neon](https://neon.tech) Free PostgreSQL | නොමිලේ |
| AI + කටහඬ | [Gemini API](https://aistudio.google.com/apikey) free tier | නොමිලේ |

> **Free plan සීමාවන්:** Render free backend එක විනාඩි 15 ක් පාවිච්චි නොකළොත් "නිදාගන්නවා". ඊළඟ පාර open කරද්දී
> විනාඩියක් විතර ගතවෙනවා (Web IDE එකේ "Waking up Saki's server…" කියලා පේනවා). ඊට පස්සේ සාමාන්‍ය වේගයෙන් වැඩ කරනවා.

ඉහළින් පහළට පිළිවෙලින් කරන්න. මුළු වැඩේට විනාඩි 20–30 ක් යනවා.

---

## පියවර 1 — GitHub එකට project එක දාන්න

1. <https://github.com/new> open කරන්න.
2. පුරවන්න:
   - **Repository name:** `saki-ai`
   - **Description:**
     `🎙️ Saki AI — a bilingual Sinhala & English voice coding assistant. Ask by voice or text, hear a natural spoken answer and get complete code in a web IDE. Spring Boot · React · Flutter · Gemini.`
   - **Public** හෝ **Private** (දෙකම Vercel/Render එක්ක වැඩ කරනවා)
   - **Add a README / .gitignore / license** — කිසිවක් tick කරන්න **එපා** (project එකේ දැනටමත් තියෙනවා)
3. **Create repository** ඔබන්න.
4. Project folder එකේ (`E:\my_projects\SakiAI`) terminal එකක් open කරලා, `<ඔයාගේ-username>` වෙනුවට ඔයාගේ GitHub username එක දාලා run කරන්න:

   ```bash
   git remote add origin https://github.com/<ඔයාගේ-username>/saki-ai.git
   ```
   ```bash
   git push -u origin main
   ```

   පළවෙනි පාර browser window එකක් open වෙලා GitHub login එක ඉල්ලනවා — **Sign in** කරලා **Authorize** කරන්න.
5. Repo page එකේ දකුණු පැත්තේ **⚙️ (About)** ඔබලා **Topics** දාන්න:
   `voice-assistant` `sinhala` `gemini` `spring-boot` `react` `flutter` `monaco-editor` `text-to-speech` `websocket` `ai-coding-assistant`

> 🔒 `.env` file එක (keys තියෙන එක) GitHub එකට යන්නේ **නෑ** — `.gitignore` එකේ ඒක block කරලා තියෙන්නේ.

---

## පියවර 2 — Neon database එක (නොමිලේ PostgreSQL)

1. <https://console.neon.tech/signup> → **Continue with GitHub**.
2. Project එකක් හදන්න:
   - **Project name:** `saki-ai`
   - **Postgres version:** 16
   - **Region:** **AWS Asia Pacific (Singapore)** — Render backend එකත් Singapore නිසා වේගවත්.
3. Dashboard එකේ **Connect** ඔබන්න. **Connection pooling** එක **OFF** කරන්න (direct connection).
4. ඔයාට මෙහෙම string එකක් පේනවා:
   ```text
   postgresql://neondb_owner:AbCd1234@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   මේකෙන් කොටස් තුනක් ඕනි (Render එකට දාන්න):

   | Render variable | Neon string එකෙන් ගන්න කොටස | උදාහරණය |
   | --- | --- | --- |
   | `DB_URL` | `jdbc:postgresql://` + `@` එකට පස්සේ තියෙන host/database + `?sslmode=require` | `jdbc:postgresql://ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
   | `DB_USERNAME` | `postgresql://` එකට පස්සේ, `:` එකට කලින් | `neondb_owner` |
   | `DB_PASSWORD` | `:` එකට පස්සේ, `@` එකට කලින් | `AbCd1234` |

   (Tables හදන්න ඕනි නෑ — backend එක පළවෙනි පාර start වෙද්දී Flyway ඉබේම හදනවා.)

---

## පියවර 3 — Render backend එක

1. <https://dashboard.render.com/register> → **GitHub** එකෙන් sign up (card ඕනි නෑ).
2. Dashboard එකේ **New +** → **Blueprint** ඔබන්න.
3. **Connect GitHub** කරලා `saki-ai` repo එක තෝරන්න. Render එක `render.yaml` කියවලා **saki-backend** (Free) service එක පෙන්නනවා.
4. ඉල්ලන values පුරවන්න:

   | Key | දාන්න ඕනි දේ |
   | --- | --- |
   | `DB_URL` | පියවර 2 එකේ `jdbc:postgresql://…?sslmode=require` |
   | `DB_USERNAME` | පියවර 2 එකේ username |
   | `DB_PASSWORD` | පියවර 2 එකේ password |
   | `GEMINI_API_KEY` | ඔයාගේ Gemini key එක |
   | `CORS_ALLOWED_ORIGINS` | දැනට `https://saki-ai.vercel.app` දාන්න (පියවර 5 එකේදී නිවැරදි URL එකට update කරනවා) |
   | `GOOGLE_CLIENT_ID` | Google sign-in ඕනි නැත්නම් **හිස්ව** තියන්න |

   `JWT_SECRET` එක Render ඉබේම හදනවා — මුකුත් කරන්න ඕනි නෑ.
5. **Apply** ඔබන්න. පළවෙනි build එකට **විනාඩි 5–10** ක් යනවා (Java build එක).
6. Deploy වුණාම service page එකේ උඩින් URL එක පේනවා, උදා: `https://saki-backend-xxxx.onrender.com`.
   Browser එකේ `https://saki-backend-xxxx.onrender.com/actuator/health` open කරලා `{"status":"UP"}` පේනවද බලන්න.
   **මේ URL එක copy කරගන්න** — ඊළඟ පියවරට ඕනි.

---

## පියවර 4 — Vercel Web IDE එක

1. <https://vercel.com/signup> → **Continue with GitHub** (Hobby plan — නොමිලේ).
2. **Add New…** → **Project** → `saki-ai` repo එක **Import** කරන්න.
3. Settings:
   - **Root Directory:** **Edit** ඔබලා `saki-web` තෝරන්න ⚠️ (මේක වැදගත්)
   - **Framework Preset:** Vite (ඉබේම තේරෙනවා)
   - **Environment Variables:** එකක් එකතු කරන්න —

     | Name | Value |
     | --- | --- |
     | `VITE_API_BASE_URL` | පියවර 3 එකේ Render URL එක, අගට `/` නැතුව — උදා: `https://saki-backend-xxxx.onrender.com` |

4. **Deploy** ඔබන්න (විනාඩි 1–2). ඉවර වුණාම ඔයාගේ site URL එක ලැබෙනවා, උදා: `https://saki-ai.vercel.app`.

---

## පියවර 5 — Backend එකට Vercel URL එක දෙන්න (CORS)

1. Render → **saki-backend** → **Environment** ගිහින් `CORS_ALLOWED_ORIGINS` එක ඔයාගේ ඇත්ත Vercel URL එකට වෙනස් කරන්න
   (අගට `/` නැතුව), උදා: `https://saki-ai.vercel.app`.
   Local එකෙනුත් පාවිච්චි කරනවා නම් කොමා දාලා එකතු කරන්න:
   `https://saki-ai.vercel.app,http://localhost:5173,http://localhost:8081`
2. **Save, rebuild, and deploy** ඔබන්න.

✅ දැන් Vercel URL එක open කරලා account එකක් හදලා Saki එක්ක කතා කරන්න! (HTTPS නිසා mic එකත් ඕනෑම computer එකක වැඩ කරනවා.)

---

## පියවර 6 — Phone app එක online backend එකට connect කරන්න

App එකේ login screen එකේ **Server settings** ඔබලා Render URL එක දාන්න (උදා: `https://saki-backend-xxxx.onrender.com`).
දැන් Wi-Fi එකේ නැතුවත්, ඕනෑම තැනක ඉඳන් phone එක වැඩ කරනවා.

---

## (විකල්ප) Google sign-in online එකේ

1. <https://console.cloud.google.com/auth/clients> → ඔයාගේ **Web** client එක open කරන්න.
2. **Authorized JavaScript origins** එකට Vercel URL එක එකතු කරන්න (උදා: `https://saki-ai.vercel.app`) → **Save**.
3. Render → **Environment** → `GOOGLE_CLIENT_ID` = ඒ client ID එක → **Save, rebuild, and deploy**.

---

## Updates දාන්නේ කොහොමද?

Code එක වෙනස් කරලා GitHub එකට push කළාම Vercel සහ Render දෙකම **ඉබේම** අලුත් version එක deploy කරනවා:

```bash
git add -A
```
```bash
git commit -m "Describe your change"
```
```bash
git push
```

---

## ප්‍රශ්න ආවොත්

| ප්‍රශ්නය | විසඳුම |
| --- | --- |
| Web IDE එකේ "Waking up Saki's server…" විනාඩියක් පේනවා | සාමාන්‍යයි — free backend එක නිදාගෙන හිටියා. ඉඳලා බලන්න. |
| Sign up කරද්දී "not reachable" / CORS error | Render එකේ `CORS_ALLOWED_ORIGINS` එක Vercel URL එකට **හරියටම** සමානද බලන්න (`https://`, අගට `/` නැතුව). |
| Vercel build එක fail | Vercel project settings එකේ **Root Directory** = `saki-web` ද බලන්න. |
| Render deploy එක fail, logs වල database error | `DB_URL` එක `jdbc:postgresql://` වලින් පටන් ගන්නවද, `?sslmode=require` අගට තියෙනවද, Neon pooling OFF ද බලන්න. |
| "Saki has used up its Gemini API quota" | Gemini free quota එක ඉවරයි — දිනපතා reset වෙනවා, නැත්නම් වෙන Google account එකකින් අලුත් key එකක් හදලා Render එකේ `GEMINI_API_KEY` මාරු කරන්න. |
| Mic එක allow කරන්න ඉල්ලන්නේ නෑ | Vercel URL එක `https://` එක්කද open කළේ බලන්න; browser එකේ site settings වල microphone **Allow** කරන්න. |
