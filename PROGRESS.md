# ARNA — Progress

## Done
- [x] Rebranded ABHI AI → ARNA
- [x] Fixed: client called non-existent `/api/health` (always "Server unreachable") → `/api/status`
- [x] Fixed: production start required MongoDB/JWT secrets nothing used; now only warns about the AI key
- [x] Fixed: operational errors (503 no key, 502 upstream) would be masked as "Internal server error" in production
- [x] Streaming chat API (Gemini / Claude / OpenAI), images, validation, abort on disconnect, 10 tests
- [x] Gemini-style UI, history, settings, themes
- [x] Mobile-safe 3D orb
- [x] Mic input, female TTS, Live voice mode

## Removed (unused by the current app)
MongoDB, JWT/bcrypt auth, Socket.IO, Porcupine wake word, Recharts, drei, vendor SDKs (providers use plain `fetch`).

## Ideas for later
Accounts + cloud sync, "Hey Arna" wake word, web search, file upload, server-side neural TTS.


## Update: multilingual assistant modes
- Added Health Assistant, Interview Preparation, Friendly Chat and Voice Assistant dashboard entry points.
- Added server-side assistant mode instructions for health safety and interview coaching.
- Changed fresh-install voice input default to Telugu (te-IN).
- Added Telugu/English script detection for spoken reply voice selection.
- Improved Telugu voice ranking and added Settings guidance about browser speech recognition limitations.
- Note: Browser speech recognition remains single-language per session; select Telugu or English in Settings. Telugu TTS depends on an installed browser/device voice.
