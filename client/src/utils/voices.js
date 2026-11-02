// Picks a female-sounding text-to-speech voice. Browsers do not expose a "gender" field,
// so we rank voices by well-known female voice names across Chrome, Edge, Android, macOS and iOS.

const FEMALE = [
  'female', 'woman', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'fiona', 'allison', 'ava', 'susan', 'zoe',
  'serena', 'kate', 'nicky', 'joanna', 'salli', 'kendra', 'kimberly', 'ivy', 'zira', 'aria', 'jenny', 'michelle',
  'hazel', 'libby', 'sonia', 'natasha', 'catherine', 'linda', 'heera', 'neerja', 'swara', 'kalpana', 'veena',
  'lekha', 'shruti', 'priya', 'raveena', 'aditi', 'google us english', 'google uk english female',
  'google हिन्दी', 'google hindi', 'eva', 'helena', 'paulina', 'monica', 'marisol', 'amelie', 'marie', 'hortense',
  'denise', 'katja', 'anna', 'elsa', 'isabella', 'laura', 'lucia', 'mia', 'sara', 'ioana', 'milena', 'yelda',
];
const MALE = [
  'male', ' man', 'david', 'mark', 'daniel', 'alex', 'fred', 'george', 'james', 'guy', 'ryan', 'prabhat', 'hemant',
  'madhur', 'mohan', 'ravi', 'rishi', 'eric', 'tom', 'oliver', 'thomas', 'jorge', 'diego', 'pablo', 'stefan',
  'conrad', 'henri', 'matthew', 'joey', 'justin', 'brian', 'arthur', 'rocko',
];

const norm = (l) => (l || '').replace('_', '-').toLowerCase();
const has = (name, list) => list.some((w) => name.includes(w));

/** Higher = better. Exported for tests. */
export function scoreVoice(v, lang) {
  const name = (v.name || '').toLowerCase();
  const vl = norm(v.lang);
  const want = norm(lang);
  let s = 0;
  if (vl === want) s += 80;
  else if (vl.split('-')[0] === want.split('-')[0]) s += 35;
  else s -= 100;
  if (has(name, MALE)) s -= 120;
  if (has(name, FEMALE)) s += 45;
  if (/natural|neural|online/.test(name)) s += 12; // higher-quality voices
  if (want === 'te-in' && /telugu|తెలుగు|google తెలుగు/i.test(name)) s += 25;
  if (name.includes('google')) s += 6;
  if (v.localService) s += 2;
  return s;
}

/**
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} lang BCP-47 tag, e.g. "en-IN"
 * @param {string} preferredName voice name chosen in settings ('' = auto)
 */
export function pickVoice(voices, lang, preferredName = '') {
  if (!voices?.length) return null;
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }
  let best = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

/** True when we recognise the voice as female by name. */
export function isKnownFemale(v) {
  if (!v) return false;
  const name = v.name.toLowerCase();
  return has(name, FEMALE) && !has(name, MALE);
}

export function voicesForLang(voices, lang) {
  const primary = norm(lang).split('-')[0];
  return voices
    .filter((v) => norm(v.lang).split('-')[0] === primary)
    .sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang));
}
