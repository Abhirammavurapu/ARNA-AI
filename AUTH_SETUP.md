# ARNA AI Authentication setup

This version adds email/password registration and login, MongoDB user records, bcrypt password hashing, and an HTTP-only JWT session cookie.

## 1. Install backend dependencies

From the project root:

```powershell
npm --prefix server install
npm --prefix client install
```

## 2. Configure `server/.env`

Copy `server/.env.example` to `server/.env` and set:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=your_rotated_mongodb_connection_string
JWT_SECRET=your_new_random_secret_at_least_32_characters_long
AI_PROVIDER=gemini
GEMINI_API_KEY=your_new_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Generate a JWT secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use newly rotated MongoDB and Gemini credentials. Do not reuse credentials previously pasted into chat. Never commit `server/.env`.

## 3. Start the application

From the project root:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Authentication behavior

- New users can create an account with name, email and a password of at least 8 characters.
- Passwords are hashed with bcrypt before saving to MongoDB.
- The session JWT is stored in an HTTP-only cookie, not localStorage.
- Chat API requests require a valid session.
- Chat history is currently kept in browser localStorage under a per-user key. It is separated between accounts on this browser, but it is not yet synced to MongoDB or across devices.
