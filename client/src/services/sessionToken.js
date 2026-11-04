const STORAGE_KEY = 'arna.session.v1';
let memoryToken = null;

export function getSessionToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Keep the session usable in browsers that disable web storage.
  }
  return memoryToken;
}

export function setSessionToken(token) {
  memoryToken = token;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // The in-memory copy still works until the page is closed.
  }
}

export function clearSessionToken() {
  memoryToken = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to clear when web storage is unavailable.
  }
}
