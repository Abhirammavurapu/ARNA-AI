import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const parseOrigins = (value) =>
  (value || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

const str = (name, fallback = '') => (process.env[name] || fallback).trim();

const ai = {
  gemini: {
    key: str('GEMINI_API_KEY') || str('GOOGLE_API_KEY'),
    model: str('GEMINI_MODEL', 'gemini-2.5-flash'),
    baseUrl: str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  },
  anthropic: {
    key: str('ANTHROPIC_API_KEY'),
    model: str('ANTHROPIC_MODEL', 'claude-sonnet-5-5'),
    baseUrl: str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com').replace(/\/$/, ''),
  },
  openai: {
    key: str('OPENAI_API_KEY'),
    model: str('OPENAI_MODEL', 'gpt-4o-mini'),
    baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com').replace(/\/$/, ''),
  },
};

/** Explicit AI_PROVIDER wins; otherwise the first provider that has a key. */
function resolveProvider() {
  const wanted = str('AI_PROVIDER').toLowerCase();
  if (wanted && ai[wanted]) return wanted;
  return ['gemini', 'anthropic', 'openai'].find((p) => ai[p].key) || wanted || 'gemini';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  appName: 'ARNA',
  clientOrigins: parseOrigins(process.env.CLIENT_URL),
  ai: { ...ai, provider: resolveProvider() },
};

export function aiConfigured() {
  return Boolean(env.ai[env.ai.provider]?.key);
}

/** Returns human-readable configuration problems (never throws). */
export function validateEnv() {
  const problems = [];
  if (!aiConfigured()) {
    problems.push(
      `No API key for AI provider "${env.ai.provider}". Set GEMINI_API_KEY (free tier available), ANTHROPIC_API_KEY or OPENAI_API_KEY.`
    );
  }
  return problems;
}

export default env;
