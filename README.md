# ARNA — Your AI Companion

A Gemini-style AI assistant with a **3D animated orb**, **voice input (mic)** and a **female voice** that talks back.

## Features
- **Streaming chat** with Markdown, tables, syntax-highlighted code (copy button), regenerate, stop
- **Image understanding** — attach or paste up to 4 images
- **Mic button** — talk, and ARNA answers out loud in a female voice
- **Live mode** — hands-free conversation (listen → think → speak → listen); tap the orb to interrupt
- **Female voice auto-selection** across Chrome, Edge, Android and iOS/macOS, with a voice picker and preview
- **Languages** — Telugu and English voice input; response speech selects Telugu or English from the text script. Additional browser speech languages are available in Settings
- **3D orb** (React Three Fiber) that reacts to idle / listening / thinking / speaking
- **Assistant modes** — Health Assistant, Interview Preparation and Friendly Chat dashboard cards
- Chat history (search, rename, delete), light/dark theme, mobile drawer layout
- AI providers: **Google Gemini (free tier)**, Anthropic Claude, OpenAI — whichever key you set

## Run locally
```bash
npm run install:all
cp server/.env.example server/.env     # add GEMINI_API_KEY (free: https://aistudio.google.com/apikey)
npm run dev
```
Open the Vite URL printed in your terminal (often http://localhost:5173). The microphone needs **HTTPS** (or localhost), so test voice on a phone using a deployed HTTPS URL. Open Settings and select Telugu (te-IN) when speaking Telugu; browser speech recognition does not reliably auto-detect mixed Telugu and English.

## Deploy
- **Backend (Render)**: root `server`, start `npm start`; env: AI key, `CLIENT_URL=https://your-app.vercel.app`
- **Frontend (Vercel)**: root `client`, build `npm run build`; API defaults to `https://arna-ai-21.onrender.com` in production. Set `VITE_API_URL` to override it.

## Why the 3D orb stays smooth on phones
Lazy-loaded 3D code with an instant CSS orb meanwhile; pixel ratio capped at 1.5 on touch; fewer polygons/particles on phones; automatic quality drop (then CSS fallback) if frames are slow; rendering pauses when off-screen or the tab is hidden; the canvas never captures touch, so scrolling is never blocked; falls back on WebGL loss or reduced-motion.

## Notes
- Speech recognition uses the browser's speech service (Chrome/Edge/Safari). Firefox has none.
- Spoken voices come from the device/browser. Telugu speech output requires a Telugu (te-IN) voice installed and exposed by the browser; if none is available, install Telugu speech support in your operating system/browser. The app detects Telugu script for voice selection but does not bundle a cloud neural-TTS service.
- Chats are stored only in your browser. Attached images are not saved.
- `npm test` runs the backend tests against a mock AI upstream.
