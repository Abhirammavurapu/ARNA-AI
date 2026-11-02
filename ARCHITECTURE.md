# ARNA — Architecture

```
Browser (React + Vite)                          Express API
 useChats (history, SSE streaming) ───────────▶ POST /api/chat  (SSE: delta | done | error)
 useTTS (SpeechSynthesis, female voice)           └ services/ai/providers.js → Gemini | Claude | OpenAI
 useRecognition (SpeechRecognition)             GET /api/status (provider + key configured?)
 Orb → lazy OrbCanvas (R3F shader orb)
```
- Keys live only on the server. `/api/chat` validates input, rate-limits (30/min) and cancels the upstream call if the client disconnects.
- `voice:true` makes the system prompt ask for short spoken-style answers without Markdown.
- Streamed replies are split into sentences and queued to TTS, so ARNA starts speaking before the answer finishes.
- Voice choice (`utils/voices.js`) ranks installed voices by language and known female names, penalising male names; pitch is raised slightly if no known female voice exists.
- Live mode (`components/voice/LiveVoice.jsx`) is a small state machine: listening → thinking → speaking → listening.
