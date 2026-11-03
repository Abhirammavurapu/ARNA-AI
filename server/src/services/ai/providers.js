
import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';
import { readSSE } from './sse.js';

const MAX_OUTPUT_TOKENS = 2048;

function geminiGenerationConfig(model) {
  const config = {
    temperature: 0.8,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };

  if (/^gemini-2\.5-flash(?:-|$)/i.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  } else if (/^gemini-3(?:\.|-\d)/i.test(model)) {
    config.thinkingConfig = { thinkingLevel: 'LOW' };
  }

  return config;
}

const OLLAMA_URL = (
  process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
).replace(/\/$/, '');

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

function splitDataUrl(url) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);

  return match
    ? { mime: match[1].toLowerCase(), data: match[2] }
    : null;
}

async function upstreamError(res, label) {
  let detail = '';

  try {
    const data = await res.json();

    detail =
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data).slice(0, 300);
  } catch {
    // Response body was not JSON.
  }

  let status = 502;
  let code = 'AI_UPSTREAM_ERROR';

  if (res.status === 401 || res.status === 403) {
    status = 502;
    code = 'AI_AUTH_ERROR';
    detail = `${label} API key was rejected. Check your API key in Render Environment.`;
  } else if (res.status === 429) {
    status = 429;
    code = 'AI_RATE_LIMITED';
    detail = 'ARNA has reached its AI usage limit. Please try again later.';
  } else if (
    [500, 502, 503, 504].includes(res.status)
  ) {
    status = 503;
    code = 'AI_TEMPORARILY_UNAVAILABLE';
    detail = `${label} is temporarily unavailable. Please try again. ${detail}`;
  } else if (res.status === 400 || res.status === 404) {
    status = 502;
    code = 'AI_REQUEST_ERROR';
    detail = `${label} rejected the request. Check the model name. ${detail}`;
  }

  return new AppError(
    detail.trim() || `${label} request failed (${res.status})`,
    status,
    code
  );
}

// --------------------------------------------------------------- GEMINI ----

async function* gemini({ system, messages, signal }) {
  const cfg = env.ai.gemini;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [
      ...(m.images || []).flatMap((url) => {
        const image = splitDataUrl(url);

        return image
          ? [{
              inlineData: {
                mimeType: image.mime,
                data: image.data,
              },
            }]
          : [];
      }),
      { text: m.content || ' ' },
    ],
  }));

  const res = await fetch(
    `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(
      cfg.model
    )}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cfg.key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: system || 'You are ARNA, a helpful AI assistant.',
            },
          ],
        },
        contents,
        generationConfig: geminiGenerationConfig(cfg.model),
      }),
    }
  );

  if (!res.ok) {
    throw await upstreamError(res, 'Gemini');
  }

  let produced = false;

  for await (const data of readSSE(res.body, signal)) {
    let event;

    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    if (event.promptFeedback?.blockReason) {
      throw new AppError(
        'That request was blocked by the AI safety filter.',
        422,
        'AI_BLOCKED'
      );
    }

    const candidate = event.candidates?.[0];

    const text = (candidate?.content?.parts || [])
      .map((part) => part.text || '')
      .join('');

    if (text) {
      produced = true;
      yield text;
    }

    if (candidate?.finishReason === 'SAFETY' && !produced) {
      throw new AppError(
        'That response was blocked by the AI safety filter.',
        422,
        'AI_BLOCKED'
      );
    }
  }
}

// ------------------------------------------------------------- ANTHROPIC ----

async function* anthropic({ system, messages, signal }) {
  const cfg = env.ai.anthropic;

  const apiMessages = messages.map((m) => {
    const images = (m.images || []).flatMap((url) => {
      const image = splitDataUrl(url);

      return image
        ? [{
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mime,
              data: image.data,
            },
          }]
        : [];
    });

    return {
      role: m.role,
      content: images.length
        ? [...images, { type: 'text', text: m.content || ' ' }]
        : m.content || ' ',
    };
  });

  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: apiMessages,
      stream: true,
    }),
  });

  if (!res.ok) {
    throw await upstreamError(res, 'Anthropic');
  }

  for await (const data of readSSE(res.body, signal)) {
    let event;

    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      event.delta.text
    ) {
      yield event.delta.text;
    } else if (event.type === 'error') {
      throw new AppError(
        event.error?.message || 'Anthropic stream error',
        502,
        'AI_UPSTREAM_ERROR'
      );
    }
  }
}

// ---------------------------------------------------------------- OPENAI ----

async function* openai({ system, messages, signal }) {
  const cfg = env.ai.openai;

  const apiMessages = [
    { role: 'system', content: system || 'You are ARNA.' },

    ...messages.map((m) => {
      const images = (m.images || []).map((url) => ({
        type: 'image_url',
        image_url: { url },
      }));

      return {
        role: m.role,
        content: images.length
          ? [
              { type: 'text', text: m.content || ' ' },
              ...images,
            ]
          : m.content || ' ',
      };
    }),
  ];

  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: apiMessages,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });

  if (!res.ok) {
    throw await upstreamError(res, 'OpenAI');
  }

  for await (const data of readSSE(res.body, signal)) {
    if (data === '[DONE]') return;

    let event;

    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    const text = event.choices?.[0]?.delta?.content;

    if (text) {
      yield text;
    }
  }
}

// --------------------------------------------------------------- OLLAMA ----

async function* ollama({ system, messages, signal }) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');

  if (
    lastUserMessage?.images?.length &&
    !lastUserMessage.content?.trim()
  ) {
    throw new AppError(
      'ARNA local AI currently supports text messages, not image-only requests. Please describe the image in text.',
      422,
      'OLLAMA_TEXT_ONLY'
    );
  }

  const conversation = messages
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content:
        typeof message.content === 'string'
          ? message.content.trim()
          : '',
    }))
    .filter((message) => message.content.length > 0);

  if (!conversation.some((message) => message.role === 'user')) {
    throw new AppError(
      'Please enter a message before asking ARNA.',
      400,
      'EMPTY_MESSAGE'
    );
  }

  const apiMessages = [
    {
      role: 'system',
      content:
        system ||
        'You are ARNA, a friendly, helpful and conversational AI assistant. Answer clearly and naturally.',
    },
    ...conversation,
  ];

  let res;

  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: apiMessages,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: MAX_OUTPUT_TOKENS,
        },
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }

    throw new AppError(
      'ARNA local AI is unavailable. Make sure Ollama is running on your computer.',
      503,
      'OLLAMA_UNAVAILABLE'
    );
  }

  if (!res.ok) {
    let detail = '';

    try {
      const data = await res.json();
      detail = data.error || '';
    } catch {
      // Ignore invalid response body.
    }

    throw new AppError(
      detail || 'ARNA could not connect to its local AI model.',
      503,
      'OLLAMA_ERROR'
    );
  }

  if (!res.body) {
    throw new AppError(
      'Ollama returned an empty response.',
      502,
      'OLLAMA_EMPTY_RESPONSE'
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  async function processLine(line) {
    if (!line.trim()) return '';

    let event;

    try {
      event = JSON.parse(line);
    } catch {
      return '';
    }

    if (event.error) {
      throw new AppError(
        event.error,
        502,
        'OLLAMA_ERROR'
      );
    }

    return event.message?.content || '';
  }

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const text = await processLine(line);

        if (text) {
          yield text;
        }
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      const text = await processLine(buffer);

      if (text) {
        yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --------------------------------------------------------------- ROUTER ----

const adapters = {
  gemini,
  anthropic,
  openai,
};

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('Request cancelled');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);

      const error = new Error('Request cancelled');
      error.name = 'AbortError';
      reject(error);
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function* streamChat(args) {
  const provider = env.ai.provider;
  const adapter = adapters[provider];

  if (!adapter) {
    throw new AppError(
      `Unknown AI provider "${provider}"`,
      500,
      'AI_NOT_CONFIGURED'
    );
  }

  if (provider !== 'gemini') {
    yield* adapter(args);
    return;
  }

  const maxAttempts = 3;
  const retryableCodes = new Set([
    'AI_RATE_LIMITED',
    'AI_TEMPORARILY_UNAVAILABLE',
  ]);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let produced = false;

    try {
      for await (const chunk of gemini(args)) {
        produced = true;
        yield chunk;
      }

      return;
    } catch (err) {
      if (err.name === 'AbortError' || produced) {
        throw err;
      }

      if (
        !retryableCodes.has(err.code) ||
        attempt === maxAttempts
      ) {
        throw err;
      }

      const delay = attempt * 2000;

      console.log(
        `[ARNA] Gemini temporarily unavailable. Retry ${attempt + 1}/${maxAttempts} in ${delay}ms.`
      );

      await waitForRetry(delay, args.signal);
    }
  }
}
