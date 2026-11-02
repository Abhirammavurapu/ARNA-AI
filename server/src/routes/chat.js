import { Router } from 'express';
import env, { aiConfigured } from '../config/env.js';
import AppError from '../utils/AppError.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { streamChat } from '../services/ai/providers.js';
import { buildSystemPrompt } from '../services/ai/prompt.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const MAX_MESSAGES = 30;
const MAX_TEXT = 20000;
const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 4 * 1024 * 1024; // base64 characters per image
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/** Validate and normalise the request body. Throws AppError(400) on bad input. */
export function parseChatBody(body) {
  const bad = (msg) => new AppError(msg, 400, 'VALIDATION_ERROR');
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw bad('messages must be a non-empty array');
  }
  const messages = body.messages.slice(-MAX_MESSAGES).map((m, i) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) throw bad(`messages[${i}].role is invalid`);
    const content = typeof m.content === 'string' ? m.content : '';
    if (content.length > MAX_TEXT) throw bad(`messages[${i}] is too long`);
    const images = Array.isArray(m.images) ? m.images : [];
    if (images.length > MAX_IMAGES) throw bad(`At most ${MAX_IMAGES} images per message`);
    for (const img of images) {
      if (typeof img !== 'string' || img.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(img)) {
        throw bad('Unsupported or oversized image');
      }
    }
    if (!content.trim() && images.length === 0) throw bad(`messages[${i}] is empty`);
    return { role: m.role, content, images };
  });
  // Providers require the conversation to start with a user turn and end with one.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    throw bad('The last message must be from the user');
  }
  return {
    messages,
    voice: body.voice === true,
    lang: typeof body.lang === 'string' ? body.lang.slice(0, 12) : 'en-US',
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '',
    mode: ['friendly', 'health', 'interview'].includes(body.mode) ? body.mode : 'friendly',
  };
}

router.post('/', authenticate, aiLimiter, async (req, res, next) => {
  let opts;
  try {
    if (!aiConfigured()) {
      throw new AppError(
        'ARNA has no AI key yet. Add GEMINI_API_KEY (free), ANTHROPIC_API_KEY or OPENAI_API_KEY to server/.env and restart the server.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }
    opts = parseChatBody(req.body);
  } catch (err) {
    return next(err);
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let started = false;
  const startStream = () => {
    if (started) return;
    started = true;
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
  };
  let heartbeat;

  try {
    const system = buildSystemPrompt(opts);
    const stream = streamChat({ system, messages: opts.messages, signal: controller.signal });
    // Pull the first chunk before sending headers so upstream failures become proper HTTP errors.
    let first = await stream.next();
    startStream();
    heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    while (!first.done) {
      send({ type: 'delta', text: first.value });
      first = await stream.next();
    }
    send({ type: 'done' });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) return res.end();
    if (!started) return next(err);
    console.error(`[${env.appName}] stream error:`, err.message);
    send({ type: 'error', code: err.code || 'AI_UPSTREAM_ERROR', message: err.message });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

export default router;
