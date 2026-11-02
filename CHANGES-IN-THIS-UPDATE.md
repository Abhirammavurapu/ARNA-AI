# ARNA AI update notes

This update keeps the existing React/Vite + Express/Gemini project and adds targeted improvements.

## Included
- New home dashboard cards for Health Assistant, Interview Preparation, Friendly Chat and Voice Assistant.
- Assistant mode is sent to the backend and retained with each chat.
- Health mode adds safety instructions: general wellness information only, no diagnosis or medication prescriptions.
- Interview mode acts as an interview coach and supports one-question-at-a-time mock interview practice.
- Telugu/English response-language instructions are strengthened on the server.
- Fresh installations default voice input to Telugu (`te-IN`); change Settings to English (`en-IN`) when speaking English.
- Text-to-speech checks the text script and selects a Telugu or English device voice accordingly.
- Telugu voice matching is prioritised when available.
- Orb fallback animation has additional animated energy rings and reduced-motion support.
- Development CORS accepts localhost Vite ports (including 5175) so port fallback does not block local API calls.
- `.gitignore` now excludes `.env.*` files while allowing `.env.example`.

## Setup
1. Extract the ZIP.
2. In the project folder run `npm install`, `npm --prefix server install`, and `npm --prefix client install` if dependencies are not already installed.
3. Copy `server/.env.example` to `server/.env` and add a valid Gemini API key.
4. Start with `npm run dev` from the project root.
5. Open the Vite URL shown in the terminal.
6. In ARNA Settings choose Telugu (te-IN) when speaking Telugu, or English (India) when speaking English.

## Telugu speech limitations
- Browser speech recognition generally uses one language per listening session; it cannot reliably auto-detect Telugu and English mixed speech. Select the input language in Settings.
- Telugu text-to-speech depends on the Telugu voice installed and exposed by the operating system/browser. If the device has no Telugu voice, install one or use a dedicated cloud TTS provider; this project does not include a cloud TTS key/service.
- The backend uses the model configured by `GEMINI_MODEL`. The sample `.env.example` uses `gemini-2.5-flash`; use a model name currently available to your Google AI Studio API key.

## Validation
JavaScript server and utility files were syntax-checked. A full Vite production build was not run in this environment because dependencies could not be installed here; run `npm --prefix client run build` locally to verify the build in your environment.
