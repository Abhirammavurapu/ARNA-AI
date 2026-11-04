import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'arna-test-session-secret-with-at-least-32-characters';
const { default: env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { buildSystemPrompt, detectLanguageStyle } = await import('../src/services/ai/prompt.js');

const session = jwt.sign(
  { sub: 'test-user' },
  process.env.JWT_SECRET,
  { issuer: 'arna-ai' }
);

let upstream, api, upstreamPort, apiPort;
const seen = [];

const sse = (res, lines) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  lines.forEach((l) => res.write(`data: ${l}\n\n`));
  res.end();
};

before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(body || '{}') });
      if (req.headers['x-force-error']) return;
      if (req.url.includes('streamGenerateContent')) {
        if (req.headers['x-goog-api-key'] === 'bad') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { message: 'API key not valid' } }));
        }
        return sse(res, [
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] }),
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'lo!' }] }, finishReason: 'STOP' }] }),
        ]);
      }
      if (req.url === '/v1/messages') {
        return sse(res, [
          JSON.stringify({ type: 'message_start' }),
          JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } }),
          JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo!' } }),
          JSON.stringify({ type: 'message_stop' }),
        ]);
      }
      return sse(res, [
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo!' } }] }),
        '[DONE]',
      ]);
    });
  });
  await new Promise((r) => upstream.listen(0, r));
  upstreamPort = upstream.address().port;
  api = http.createServer(createApp());
  await new Promise((r) => api.listen(0, r));
  apiPort = api.address().port;
  for (const p of ['gemini', 'groq', 'anthropic', 'openai']) {
    env.ai[p].key = 'test-key';
    env.ai[p].baseUrl = `http://127.0.0.1:${upstreamPort}`;
  }
});

after(() => {
  upstream.close();
  api.close();
});

const post = (body) =>
  fetch(`http://127.0.0.1:${apiPort}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `arna_session=${session}`,
    },
    body: JSON.stringify(body),
  });

test('detects Telugu script and common Roman Telugu while preserving English', () => {
  for (const message of [
    'Nuvvu ela unnav?',
    'naku coding nerpinchu',
    'Naaku oka doubt undhi, help cheyyi',
    'Hi, naaku Java nerpinchu',
    'Nenu Telugu lo matladutunnanu, naaku Java nerpinchu',
    'Meeru ela unnaru?',
    'Naaku idi chala bagundi',
    'Naaku weather gurinchi cheppandi',
    'Nenu ippudu Telugu lo matladutunnanu',
    'నాకు Python నేర్పించు',
  ]) {
    assert.equal(detectLanguageStyle(message), 'TELUGU', message);
  }

  for (const message of [
    'Hello ARNA, how are you?',
    'Can you teach me Java?',
    'What is Telugu grammar?',
    'Can you show me how to learn Python?',
    'I want to learn Telugu grammar in English.',
  ]) {
    assert.equal(detectLanguageStyle(message), 'ENGLISH', message);
  }
});

test('detects Hindi script and common Roman Hindi', () => {
  for (const message of [
    'मुझे हिंदी में जवाब दो',
    'आप कैसे हैं?',
    'Mujhe Hindi mein jawab do',
    'Kripya meri madad kijiye',
  ]) {
    assert.equal(detectLanguageStyle(message), 'HINDI', message);
  }

  assert.equal(detectLanguageStyle('Can you translate Hindi?'), 'ENGLISH');
});

test('system prompt explicitly requires the detected reply language', () => {
  assert.match(
    buildSystemPrompt({ latestMessage: 'Naku coding nerpinchu' }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
  assert.match(
    buildSystemPrompt({ latestMessage: 'Please teach me coding' }),
    /REQUIRED RESPONSE LANGUAGE: English/
  );
});

test('voice reply language follows transcript rather than recognition setting', () => {
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'te-IN',
      latestMessage: 'How are you?',
    }),
    /REQUIRED RESPONSE LANGUAGE: English/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'en-IN',
      latestMessage: 'నువ్వు ఎలా ఉన్నావు?',
    }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'hi-IN',
      latestMessage: 'నువ్వు ఎలా ఉన్నావు?',
    }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'te-IN',
      latestMessage: 'Poyyi daggara unnanu',
    }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'te-IN',
      latestMessage: 'What is the weather today?',
    }),
    /REQUIRED RESPONSE LANGUAGE: English/
  );
  assert.match(
    buildSystemPrompt({
      voice: false,
      lang: 'en-IN',
      latestMessage: 'Nuvvu ela unnav?',
    }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
});

test('auto voice replies follow the recognized transcript language', () => {
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'auto',
      latestMessage: 'Nuvvu ela unnav?',
    }),
    /REQUIRED RESPONSE LANGUAGE: Telugu/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'auto',
      latestMessage: 'How are you?',
    }),
    /REQUIRED RESPONSE LANGUAGE: English/
  );
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'auto',
      latestMessage: 'मुझे हिंदी में जवाब दो',
    }),
    /REQUIRED RESPONSE LANGUAGE: Hindi/
  );
});

test('Hindi transcript is answered in Hindi regardless of recognition setting', () => {
  assert.match(
    buildSystemPrompt({
      voice: true,
      lang: 'te-IN',
      latestMessage: 'मुझे हिंदी में जवाब दो',
    }),
    /REQUIRED RESPONSE LANGUAGE: Hindi/
  );
});

test('speech endpoint rejects unsupported neural speech languages', async () => {
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', lang: 'en-IN' }),
  });
  assert.equal(res.status, 400);
});

async function collect(res) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter((b) => b.startsWith('data: '))
    .map((b) => JSON.parse(b.slice(6)));
}

for (const provider of ['gemini', 'groq', 'anthropic', 'openai']) {
  test(`${provider}: streams deltas then done`, async () => {
    env.ai.provider = provider;
    const res = await post({ messages: [{ role: 'user', content: 'hi' }], voice: true, name: 'Abhi' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const events = await collect(res);
    assert.equal(events.filter((e) => e.type === 'delta').map((e) => e.text).join(''), 'Hello!');
    assert.equal(events.at(-1).type, 'done');
  });
}

test('voice flag and name reach the system prompt', async () => {
  env.ai.provider = 'gemini';
  seen.length = 0;
  await (await post({ messages: [{ role: 'user', content: 'hi' }], voice: true, name: 'Abhi' })).text();
  const sys = seen[0].body.systemInstruction.parts[0].text;
  assert.match(sys, /read aloud/);
  assert.match(sys, /Abhi/);
  assert.match(sys, /ARNA/);
});

test('images are forwarded in each provider format', async () => {
  const img = 'data:image/png;base64,iVBORw0KGgo=';
  const msgs = [{ role: 'user', content: 'what is this', images: [img] }];
  seen.length = 0;
  env.ai.provider = 'gemini';
  await (await post({ messages: msgs })).text();
  assert.equal(seen.at(-1).body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  env.ai.provider = 'anthropic';
  await (await post({ messages: msgs })).text();
  assert.equal(seen.at(-1).body.messages[0].content[0].source.media_type, 'image/png');
  env.ai.provider = 'openai';
  await (await post({ messages: msgs })).text();
  assert.equal(seen.at(-1).body.messages[1].content[1].image_url.url, img);
});

test('Groq uses its vision model for image messages', async () => {
  const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  env.ai.provider = 'groq';
  env.ai.groq.model = 'openai/gpt-oss-20b';
  env.ai.groq.visionModel = 'qwen/qwen3.8-27b';
  await (await post({
    messages: [{ role: 'user', content: 'What is in this picture?', images: [img] }],
  })).text();

  const request = seen.at(-1).body;
  assert.equal(request.model, 'qwen/qwen3.8-27b');
  assert.equal(request.messages[1].content[1].image_url.url, img);
});

test('Groq includes only the 3 most recent images from conversation history', async () => {
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  env.ai.provider = 'groq';
  const olderImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const newestImage = 'data:image/webp;base64,UklGRg==';
  await (await post({
    messages: [
      { role: 'user', content: 'Look at this old photo', images: [olderImage] },
      { role: 'assistant', content: 'Okay' },
      { role: 'user', content: 'Compare these', images: [image, image, newestImage] },
    ],
  })).text();
  const content = seen.at(-1).body.messages.flatMap((message) =>
    Array.isArray(message.content)
      ? message.content.filter((part) => part.type === 'image_url')
      : []
  );
  assert.equal(content.length, 3);
  assert.deepEqual(
    content.map((part) => part.image_url.url),
    [image, image, newestImage]
  );
  assert.equal(seen.at(-1).body.model, 'qwen/qwen3.8-27b');
});

test('Groq uses its text model for text-only conversations', async () => {
  env.ai.provider = 'groq';
  env.ai.groq.model = 'openai/gpt-oss-20b';
  await (await post({
    messages: [{ role: 'user', content: 'Hello' }],
  })).text();
  assert.equal(seen.at(-1).body.model, 'openai/gpt-oss-20b');
});

test('rejects bad input with 400', async () => {
  env.ai.provider = 'gemini';
  for (const body of [
    {},
    { messages: [] },
    { messages: [{ role: 'system', content: 'x' }] },
    { messages: [{ role: 'user', content: '' }] },
    { messages: [{ role: 'assistant', content: 'x' }] },
    { messages: [{ role: 'user', content: 'x', images: ['data:text/html;base64,AAAA'] }] },
  ]) {
    const res = await post(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
  }
});

test('upstream auth failure becomes a clear 502 JSON error', async () => {
  env.ai.provider = 'gemini';
  env.ai.gemini.key = 'bad';
  const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
  env.ai.gemini.key = 'test-key';
  assert.equal(res.status, 502);
  const j = await res.json();
  assert.equal(j.error.code, 'AI_AUTH_ERROR');
  assert.match(j.error.message, /rejected/);
});

test('missing key returns 503 AI_NOT_CONFIGURED', async () => {
  env.ai.provider = 'openai';
  const old = env.ai.openai.key;
  env.ai.openai.key = '';
  const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
  env.ai.openai.key = old;
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'AI_NOT_CONFIGURED');
});

test('status endpoint reports configuration, /api/health is gone', async () => {
  env.ai.provider = 'gemini';
  const s = await (await fetch(`http://127.0.0.1:${apiPort}/api/status`)).json();
  assert.equal(s.success, true);
  assert.equal(s.aiConfigured, true);
  assert.equal(s.service, 'ARNA API');
});

test('backend root explains that this is an API and links status', async () => {
  const res = await fetch(`http://127.0.0.1:${apiPort}/`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.service, 'ARNA API');
  assert.match(body.message, /backend/);
  assert.equal(body.statusUrl, '/api/status');
});

test('disallowed origin gets 403', async () => {
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/status`, { headers: { Origin: 'http://evil.example' } });
  assert.equal(res.status, 403);
});
