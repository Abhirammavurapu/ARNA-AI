
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
const MAX_IMAGE_CHARS = 4 * 1024 * 1024;

const IMAGE_RE =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/**
 * Validate and normalize the chat request.
 */
export function parseChatBody(body) {
  const bad = (msg) =>
    new AppError(msg, 400, 'VALIDATION_ERROR');

  if (
    !body ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    throw bad('messages must be a non-empty array');
  }

  if (body.messages.length > 100) {
    throw bad('Too many messages in the request');
  }

  const normalized = body.messages
    .slice(-MAX_MESSAGES)
    .map((m, i) => {
      if (
        !m ||
        (m.role !== 'user' && m.role !== 'assistant')
      ) {
        throw bad(`messages[${i}].role is invalid`);
      }

      const content =
        typeof m.content === 'string' ? m.content : '';

      if (content.length > MAX_TEXT) {
        throw bad(`messages[${i}] is too long`);
      }

      const images = Array.isArray(m.images)
        ? m.images
        : [];

      if (images.length > MAX_IMAGES) {
        throw bad(`At most ${MAX_IMAGES} images per message`);
      }

      for (const img of images) {
        if (
          typeof img !== 'string' ||
          img.length > MAX_IMAGE_CHARS ||
          !IMAGE_RE.test(img)
        ) {
          throw bad('Unsupported or oversized image');
        }
      }

      return {
        role: m.role,
        content,
        images,
      };
    });

  // Remove empty text-only messages.
  const messages = normalized.filter(
    (m) =>
      m.content.trim().length > 0 ||
      m.images.length > 0
  );

  if (messages.length === 0) {
    throw bad('Please enter a message before asking ARNA.');
  }

  // Conversation must start with a user message.
  while (messages.length && messages[0].role !== 'user') {
    messages.shift();
  }

  if (!messages.length) {
    throw bad('Please enter a valid user message.');
  }

  // Latest message must be from the user.
  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== 'user') {
    throw bad('The last message must be from the user.');
  }

  return {
    messages,
    voice: body.voice === true,
    lang:
      typeof body.lang === 'string'
        ? body.lang.slice(0, 12)
        : 'auto',
    name:
      typeof body.name === 'string'
        ? body.name.trim().slice(0, 40)
        : '',
    mode: ['friendly', 'health', 'interview'].includes(body.mode)
      ? body.mode
      : 'friendly',
  };
}

/**
 * Chat endpoint.
 * Automatically detects language from every latest user message.
 */
router.post(
  '/',
  authenticate,
  aiLimiter,
  async (req, res, next) => {
    let opts;

    try {
      if (!aiConfigured()) {
        throw new AppError(
          'ARNA has no configured AI provider.',
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
      if (!res.writableFinished) {
        controller.abort();
      }
    });

    const send = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

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
      // Get the latest user message for language detection.
      const latestUserMessage = [...opts.messages]
        .reverse()
        .find((message) => message.role === 'user');

      if (!latestUserMessage) {
        throw new AppError(
          'No valid user message found.',
          400,
          'VALIDATION_ERROR'
        );
      }

      // Build a new language-aware prompt for every request.
      const system = buildSystemPrompt({
        ...opts,
        messages: opts.messages,
        latestMessage: latestUserMessage.content,
      });

      // Send the system prompt and conversation to the AI.
      const stream = streamChat({
        system,
        messages: opts.messages,
        signal: controller.signal,
      });

      // Read first chunk before sending HTTP headers.
      let first = await stream.next();

      startStream();

      heartbeat = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      while (!first.done) {
        send({
          type: 'delta',
          text: first.value,
        });

        first = await stream.next();
      }

      send({ type: 'done' });
      res.end();

    } catch (err) {
      if (controller.signal.aborted) {
        return res.end();
      }

      if (!started) {
        return next(err);
      }

      console.error(
        `[${env.appName}] stream error:`,
        err.message
      );

      send({
        type: 'error',
        code: err.code || 'AI_UPSTREAM_ERROR',
        message: err.message,
      });

      res.end();

    } finally {
      clearInterval(heartbeat);
    }
  }
);

export default router;
