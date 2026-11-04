import { API_BASE } from './chatApi.js';
import { clearSessionToken, getSessionToken, setSessionToken } from './sessionToken.js';

async function request(path, options = {}) {
  let response;
  const token = getSessionToken();
  try {
    response = await fetch(`${API_BASE}/api/auth${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Cannot reach ARNA server. Make sure the backend is running.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Authentication failed.');
  return data;
}
export const getCurrentUser = () => request('/me');
export async function loginUser(email, password) {
  const data = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!data.token) throw new Error('Authentication response did not include a session.');
  setSessionToken(data.token);
  return data;
}
export async function registerUser(name, email, password) {
  const data = await request('/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  if (!data.token) throw new Error('Authentication response did not include a session.');
  setSessionToken(data.token);
  return data;
}
export async function logoutUser() {
  try {
    return await request('/logout', { method: 'POST', body: '{}' });
  } finally {
    clearSessionToken();
  }
}
