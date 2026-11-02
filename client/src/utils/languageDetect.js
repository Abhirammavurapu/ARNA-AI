/** Lightweight script-based language detection for Telugu/English text. */
export function detectTextLanguage(text = '', fallback = 'en-IN') {
  const value = String(text);
  // Telugu Unicode block: U+0C00–U+0C7F. This works for Telugu script mixed with English.
  const teluguChars = (value.match(/[\u0C00-\u0C7F]/g) || []).length;
  const latinChars = (value.match(/[A-Za-z]/g) || []).length;
  if (teluguChars > 0 && teluguChars >= latinChars * 0.35) return 'te-IN';
  if (latinChars > 0) return 'en-IN';
  return fallback;
}

export function languageLabel(lang) {
  return lang === 'te-IN' ? 'Telugu' : 'English';
}
