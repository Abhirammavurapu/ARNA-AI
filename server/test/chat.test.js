import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
const { default: env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');

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
  for (const p of ['gemini', 'anthropic', 'openai']) {
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function collect(res) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter((b) => b.startsWith('data: '))
    .map((b) => JSON.parse(b.slice(6)));
}

for (const provider of ['gemini', 'anthropic', 'openai']) {
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

test('disallowed origin gets 403', async () => {
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/status`, { headers: { Origin: 'http://evil.example' } });
  assert.equal(res.status, 403);
});
