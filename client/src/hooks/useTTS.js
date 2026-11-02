import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickVoice, isKnownFemale } from '../utils/voices.js';
import { chunkForSpeech } from '../utils/speech.js';
import { detectTextLanguage } from '../utils/languageDetect.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

/**
 * Text-to-speech with a female voice. Queues short chunks so streaming replies can start
 * speaking immediately and so long answers are not cut off by the browser.
 */
export function useTTS({ lang, voiceName, rate = 1 }) {
  const supported = Boolean(synth);
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  const queue = useRef([]);
  const active = useRef(false);
  const generation = useRef(0);
  const waiters = useRef([]);
  const watchdog = useRef(0);

  // Voices load asynchronously (and sometimes late on Android/iOS), so listen and poll briefly.
  useEffect(() => {
    if (!synth) return undefined;
    const read = () => {
      const list = synth.getVoices();
      if (list.length) setVoices(list);
    };
    read();
    synth.addEventListener?.('voiceschanged', read);
    const timers = [300, 1000, 2500].map((ms) => setTimeout(read, ms));
    return () => {
      synth.removeEventListener?.('voiceschanged', read);
      timers.forEach(clearTimeout);
    };
  }, []);

  const voice = useMemo(() => pickVoice(voices, lang, voiceName), [voices, lang, voiceName]);
  const cfg = useRef({});
  cfg.current = { voice, lang, rate, voices, voiceName };

  const settle = useCallback(() => {
    const ws = waiters.current;
    waiters.current = [];
    ws.forEach((fn) => fn());
  }, []);

  const pump = useCallback(() => {
    if (!synth || active.current) return;
    const text = queue.current.shift();
    if (!text) {
      setSpeaking(false);
      settle();
      return;
    }
    active.current = true;
    setSpeaking(true);
    const gen = generation.current;
    const { voice: defaultVoice, lang: defaultLang, rate: r, voices: availableVoices, voiceName: preferredName } = cfg.current;
    const l = detectTextLanguage(text, defaultLang);
    const v = l === defaultLang ? defaultVoice : pickVoice(availableVoices, l, preferredName);
    const u = new SpeechSynthesisUtterance(text);
    if (v && v.lang?.toLowerCase().startsWith(l.slice(0, 2).toLowerCase())) u.voice = v;
    u.lang = (u.voice && u.voice.lang) || l;
    u.rate = r;
    // If we could not identify a clearly female voice, lift the pitch slightly.
    u.pitch = isKnownFemale(v) ? 1.03 : 1.18;
    u.volume = 1;
    let finished = false;
    const next = () => {
      if (finished || gen !== generation.current) return;
      finished = true;
      clearTimeout(watchdog.current);
      active.current = false;
      pump();
    };
    u.onend = next;
    u.onerror = next;
    // Some mobile browsers never fire onend; do not let the queue hang forever.
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(next, 4000 + (text.length * 120) / Math.max(0.5, r));
    try {
      synth.speak(u);
    } catch {
      next();
    }
  }, [settle]);

  /** Call from a tap/click handler so iOS and Chrome allow audio later. */
  const unlock = useCallback(() => {
    if (!synth) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(
    (text, options = {}) => {
      if (!synth || !text) return;
      // An explicit language is useful for short phrases where script detection is ambiguous.
      if (options.lang) cfg.current.lang = options.lang;
      queue.current.push(...chunkForSpeech(text));
      pump();
    },
    [pump]
  );

  const cancel = useCallback(() => {
    generation.current += 1;
    queue.current = [];
    active.current = false;
    clearTimeout(watchdog.current);
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
    settle();
  }, [settle]);

  /** Run fn once everything queued so far has been spoken (immediately if idle). */
  const whenDone = useCallback((fn) => {
    if (!active.current && queue.current.length === 0) fn();
    else waiters.current.push(fn);
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  // Chrome pauses speech when the tab is hidden; stop cleanly instead of resuming late.
  useEffect(() => {
    const onHide = () => document.hidden && cancel();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [cancel]);

  return { supported, voices, voice, speaking, speak, cancel, unlock, whenDone };
}
