
const FEMALE = [
  'female', 'woman', 'samantha', 'karen', 'moira',
  'tessa', 'victoria', 'fiona', 'allison', 'ava',
  'susan', 'zoe', 'serena', 'kate', 'joanna',
  'salli', 'kendra', 'kimberly', 'ivy', 'zira',
  'aria', 'jenny', 'michelle', 'hazel', 'libby',
  'sonia', 'natasha', 'catherine', 'linda', 'heera',
  'neerja', 'swara', 'kalpana', 'veena', 'lekha',
  'shruti', 'priya', 'raveena', 'aditi', 'eva',
  'helena', 'paulina', 'monica', 'marisol', 'amelie',
  'marie', 'hortense', 'denise', 'katja', 'anna',
  'elsa', 'isabella', 'laura', 'lucia', 'mia',
  'sara', 'ioana', 'milena', 'yelda'
];

const MALE = [
  'male', ' man', 'david', 'mark', 'daniel', 'alex',
  'fred', 'george', 'james', 'guy', 'ryan', 'prabhat',
  'hemant', 'madhur', 'mohan', 'ravi', 'rishi',
  'eric', 'tom', 'oliver', 'thomas', 'jorge',
  'diego', 'pablo', 'stefan', 'conrad', 'henri',
  'matthew', 'joey', 'justin', 'brian', 'arthur',
  'rocko'
];

const norm = value =>
  (value || '').replace(/_/g, '-').toLowerCase();

const has = (name, list) =>
  list.some(word => name.includes(word));

/** Higher score means a better matching voice. */
export function scoreVoice(voice, lang) {
  const name = (voice.name || '').toLowerCase();
  const voiceLang = norm(voice.lang);
  const wantedLang = norm(lang);

  let score = 0;

  if (voiceLang === wantedLang) {
    score += 100;
  } else if (
    voiceLang.split('-')[0] === wantedLang.split('-')[0]
  ) {
    score += 50;
  } else {
    return -1000;
  }

  if (has(name, MALE)) score -= 120;
  if (has(name, FEMALE)) score += 45;

  if (/natural|neural|online/.test(name)) {
    score += 15;
  }

  if (wantedLang.startsWith('te')) {
    if (/telugu|తెలుగు/i.test(name)) {
      score += 25;
    }
  }

  if (name.includes('google')) score += 6;
  if (voice.localService) score += 2;

  return score;
}

/**
 * Select a voice for the requested language.
 * Never fall back to a different language.
 */
export function pickVoice(
  voices,
  lang,
  preferredName = ''
) {
  if (!voices?.length || !lang) return null;

  const wantedLang = norm(lang);
  const primaryLang = wantedLang.split('-')[0];

  // Only consider voices matching the requested language.
  const matchingVoices = voices.filter(voice =>
    norm(voice.lang).split('-')[0] === primaryLang
  );

  if (!matchingVoices.length) {
    return null;
  }

  // Preferred voice is accepted only if its language matches.
  if (preferredName) {
    const preferred = matchingVoices.find(
      voice => voice.name === preferredName
    );

    if (preferred) return preferred;
  }

  // Prefer exact regional language match.
  const exactVoices = matchingVoices.filter(
    voice => norm(voice.lang) === wantedLang
  );

  const candidates = exactVoices.length
    ? exactVoices
    : matchingVoices;

  return candidates.sort(
    (a, b) => scoreVoice(b, lang) - scoreVoice(a, lang)
  )[0] || null;
}

/** Check whether the voice is recognised as female. */
export function isKnownFemale(voice) {
  if (!voice) return false;

  const name = (voice.name || '').toLowerCase();

  return has(name, FEMALE) && !has(name, MALE);
}

/** Return voices available for the requested language. */
export function voicesForLang(voices, lang) {
  const primary = norm(lang).split('-')[0];

  return (voices || [])
    .filter(
      voice => norm(voice.lang).split('-')[0] === primary
    )
    .sort(
      (a, b) => scoreVoice(b, lang) - scoreVoice(a, lang)
    );
}
