
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { pickVoice, isKnownFemale } from '../utils/voices.js';
import { chunkForSpeech } from '../utils/speech.js';

const synth =
  typeof window !== 'undefined'
    ? window.speechSynthesis
    : undefined;

// Detect the language of the actual response.
function detectSpeechLanguage(text = '') {
  // Telugu script
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'te-IN';
  }

  // Basic Roman Telugu detection as a fallback
  const words = text.toLowerCase().match(/[a-z]+/g) || [];

  const teluguWords = new Set([
    'nenu', 'naaku', 'naku', 'neeku', 'nuvvu',
    'meeru', 'manam', 'ela', 'unnavu', 'unnav',
    'enti', 'enduku', 'evaru', 'cheppu', 'kavali',
    'ledu', 'undi', 'chestunnav', 'chesanu',
    'nerpinchu', 'telusu', 'teliyadu', 'kuda',
    'chala', 'ippudu', 'repu', 'avunu', 'sare',
    'ekkada', 'eppudu', 'vellali', 'chudu',
    'bagunnanu', 'baagunnanu'
  ]);

  const matches = words.filter(word =>
    teluguWords.has(word)
  ).length;

  if (matches >= 1 && words.length <= 3) {
    return 'te-IN';
  }

  if (matches >= 2) {
    return 'te-IN';
  }

  return 'en-IN';
}

export function useTTS({
  lang = 'en-IN',
  voiceName,
  rate = 1
} = {}) {
  const supported = Boolean(synth);

  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  const queue = useRef([]);
  const active = useRef(false);
  const generation = useRef(0);
  const waiters = useRef([]);
  const watchdog = useRef(0);

  // Load browser voices
  useEffect(() => {
    if (!synth) return undefined;

    const readVoices = () => {
      setVoices(synth.getVoices());
    };

    readVoices();

    synth.addEventListener?.('voiceschanged', readVoices);

    const timers = [300, 1000, 2500].map(ms =>
      setTimeout(readVoices, ms)
    );

    return () => {
      synth.removeEventListener?.('voiceschanged', readVoices);
      timers.forEach(clearTimeout);
    };
  }, []);

  const voice = useMemo(
    () => pickVoice(voices, lang, voiceName),
    [voices, lang, voiceName]
  );

  const cfg = useRef({});
  cfg.current = { voice, lang, rate, voices, voiceName };

  const settle = useCallback(() => {
    const callbacks = waiters.current;
    waiters.current = [];

    callbacks.forEach(callback => callback());
  }, []);

  const pump = useCallback(() => {
    if (!synth || active.current) return;

    const item = queue.current.shift();

    if (!item) {
      setSpeaking(false);
      settle();
      return;
    }

    const { text, language } = item;

    active.current = true;
    setSpeaking(true);

    const gen = generation.current;

    const {
      rate: speechRate,
      voices: availableVoices,
      voiceName: preferredName
    } = cfg.current;

    // Select a voice matching the actual response language
    const selectedVoice = pickVoice(
      availableVoices,
      language,
      preferredName
    );

    const utterance = new SpeechSynthesisUtterance(text);

    // Use only a matching language voice
    if (
      selectedVoice &&
      selectedVoice.lang?.toLowerCase().startsWith(
        language.slice(0, 2).toLowerCase()
      )
    ) {
      utterance.voice = selectedVoice;
    }

    utterance.lang =
      (utterance.voice && utterance.voice.lang) || language;

    utterance.rate = speechRate;

    utterance.pitch = isKnownFemale(selectedVoice) ? 1.03 : 1.05;
    utterance.volume = 1;

    let finished = false;

    const next = () => {
      if (finished || gen !== generation.current) return;

      finished = true;

      clearTimeout(watchdog.current);

      active.current = false;

      pump();
    };

    utterance.onend = next;
    utterance.onerror = next;

    clearTimeout(watchdog.current);

    watchdog.current = setTimeout(
      next,
      4000 + (text.length * 120) / Math.max(0.5, speechRate)
    );

    try {
      synth.speak(utterance);
    } catch {
      next();
    }
  }, [settle]);

  // Unlock browser speech after a user interaction
  const unlock = useCallback(() => {
    if (!synth) return;

    try {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      synth.speak(utterance);
    } catch {
      // Ignore browser errors
    }
  }, []);

  // Speak text using its detected language
  const speak = useCallback(
    (text, options = {}) => {
      if (!synth || !text || !String(text).trim()) return;

      // Determine language separately for every response.
      const language = detectSpeechLanguage(String(text));

      const chunks = chunkForSpeech(String(text));

      queue.current.push(
        ...chunks.map(chunk => ({
          text: chunk,
          language
        }))
      );

      pump();
    },
    [pump]
  );

  // Stop current speech and clear queue
  const cancel = useCallback(() => {
    generation.current += 1;

    queue.current = [];
    active.current = false;

    clearTimeout(watchdog.current);

    try {
      synth?.cancel();
    } catch {
      // Ignore browser errors
    }

    setSpeaking(false);
    settle();
  }, [settle]);

  // Run callback after speech completes
  const whenDone = useCallback(callback => {
    if (!active.current && queue.current.length === 0) {
      callback();
    } else {
      waiters.current.push(callback);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  // Stop speech when browser tab is hidden
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) cancel();
    };

    document.addEventListener('visibilitychange', onHide);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [cancel]);

  return {
    supported,
    voices,
    voice,
    speaking,
    speak,
    cancel,
    unlock,
    whenDone
  };
}
