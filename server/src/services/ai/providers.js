import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';
import { readSSE } from './sse.js';

const MAX_OUTPUT_TOKENS = 2048;

/** "data:image/png;base64,AAAA" -> { mime: "image/png", data: "AAAA" } */
function splitDataUrl(url) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);
  return m ? { mime: m[1].toLowerCase(), data: m[2] } : null;
}

async function upstreamError(res, label) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message || j?.message || JSON.stringify(j).slice(0, 300);
  } catch {
    /* body was not JSON */
  }
  let status = 502;
  let code = 'AI_UPSTREAM_ERROR';
  if (res.status === 401 || res.status === 403) {
    code = 'AI_AUTH_ERROR';
    detail = `The ${label} API key was rejected. Check the key in server/.env. ${detail}`;
  } else if (res.status === 429) {
    status = 429;
    code = 'AI_RATE_LIMITED';
    detail = `${label} rate limit or quota reached. Try again in a moment. ${detail}`;
  } else if (res.status === 400 || res.status === 404) {
    detail = `${label} rejected the request (check the model name). ${detail}`;
  }
  return new AppError(detail.trim() || `${label} request failed (${res.status})`, status, code);
}

// ---------------------------------------------------------------- Gemini ----
async function* gemini({ system, messages, signal }) {
  const cfg = env.ai.gemini;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [
      ...(m.images || []).flatMap((u) => {
        const f = splitDataUrl(u);
        return f ? [{ inlineData: { mimeType: f.mime, data: f.data } }] : [];
      }),
      { text: m.content || ' ' },
    ],
  }));
  const res = await fetch(
    `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.8, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    }
  );
  if (!res.ok) throw await upstreamError(res, 'Gemini');
  let produced = false;
  for await (const data of readSSE(res.body, signal)) {
    let evt;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    if (evt.promptFeedback?.blockReason) {
      throw new AppError('That request was blocked by the AI safety filter.', 422, 'AI_BLOCKED');
    }
    const cand = evt.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    if (text) {
      produced = true;
      yield text;
    }
    if (cand?.finishReason === 'SAFETY' && !produced) {
      throw new AppError('That response was blocked by the AI safety filter.', 422, 'AI_BLOCKED');
    }
  }
}

// ------------------------------------------------------------- Anthropic ----
async function* anthropic({ system, messages, signal }) {
  const cfg = env.ai.anthropic;
  const apiMessages = messages.map((m) => {
    const imgs = (m.images || []).flatMap((u) => {
      const f = splitDataUrl(u);
      return f ? [{ type: 'image', source: { type: 'base64', media_type: f.mime, data: f.data } }] : [];
    });
    return {
      role: m.role,
      content: imgs.length ? [...imgs, { type: 'text', text: m.content || ' ' }] : m.content || ' ',
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
  if (!res.ok) throw await upstreamError(res, 'Anthropic');
  for await (const data of readSSE(res.body, signal)) {
    let evt;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
      yield evt.delta.text;
    } else if (evt.type === 'error') {
      throw new AppError(evt.error?.message || 'Anthropic stream error', 502, 'AI_UPSTREAM_ERROR');
    }
  }
}

// ---------------------------------------------------------------- OpenAI ----
async function* openai({ system, messages, signal }) {
  const cfg = env.ai.openai;
  const apiMessages = [
    { role: 'system', content: system },
    ...messages.map((m) => {
      const imgs = (m.images || []).map((u) => ({ type: 'image_url', image_url: { url: u } }));
      return {
        role: m.role,
        content: imgs.length ? [{ type: 'text', text: m.content || ' ' }, ...imgs] : m.content || ' ',
      };
    }),
  ];
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, messages: apiMessages, stream: true, max_tokens: MAX_OUTPUT_TOKENS }),
  });
  if (!res.ok) throw await upstreamError(res, 'OpenAI');
  for await (const data of readSSE(res.body, signal)) {
    if (data === '[DONE]') return;
    let evt;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    const text = evt.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

const adapters = { gemini, anthropic, openai };

/**
 * Open a stream of text deltas from the configured provider.
 * Throws AppError before yielding when the request is rejected upstream.
 */
export async function* streamChat(args) {
  const adapter = adapters[env.ai.provider];
  if (!adapter) throw new AppError(`Unknown AI provider "${env.ai.provider}"`, 500, 'AI_NOT_CONFIGURED');
  yield* adapter(args);
}
