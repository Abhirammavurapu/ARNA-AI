const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
export const API_BASE = import.meta.env.DEV ? configuredApiUrl || '' : '';

export class ApiError extends Error {
  constructor(message, code = 'ERROR') {
    super(message);
    this.code = code;
  }
}

export async function getStatus(signal) {
  const res = await fetch(`${API_BASE}/api/status`, { signal });
  if (!res.ok) throw new ApiError(`Server returned ${res.status}`);
  return res.json();
}

/**
 * Stream a chat reply. Calls onDelta(text) for every chunk and resolves when the reply is complete.
 */
export async function streamChat({ messages, voice, lang, name, mode, signal, onDelta }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages, voice, lang, name, mode }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError("I can't reach the ARNA server. Make sure the backend is running and try again.", 'NETWORK');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code = 'ERROR';
    try {
      const j = await res.json();
      message = j.error?.message || message;
      code = j.error?.code || code;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const handle = (block) => {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return;
    let evt;
    try {
      evt = JSON.parse(data);
    } catch {
      return;
    }
    if (evt.type === 'delta') onDelta(evt.text);
    else if (evt.type === 'error') throw new ApiError(evt.message || 'The AI stream failed.', evt.code);
    else if (evt.type === 'done') finished = true;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handle(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) handle(buffer);
  } catch (err) {
    if (err.name === 'AbortError' || err instanceof ApiError) throw err;
    throw new ApiError('The connection dropped while ARNA was answering. Please try again.', 'NETWORK');
  }
  if (!finished) throw new ApiError('The connection dropped while ARNA was answering. Please try again.', 'NETWORK');
}
