import { API_BASE } from './chatApi.js';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/auth${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('Cannot reach ARNA server. Make sure the backend is running.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Authentication failed.');
  return data;
}
export const getCurrentUser = () => request('/me');
export const loginUser = (email, password) => request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const registerUser = (name, email, password) => request('/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
export const logoutUser = () => request('/logout', { method: 'POST', body: '{}' });
