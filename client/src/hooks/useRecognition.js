import { useCallback, useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

const ERRORS = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in your browser settings.',
  'service-not-allowed': 'Speech recognition is not allowed in this browser.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
  'language-not-supported': 'This language is not supported for voice input on your device.',
};

function recognitionLanguage(setting) {
  if (setting !== 'auto') return setting;
  return (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';
}

/**
 * Speech-to-text from the microphone. A fresh recognizer is created for every session,
 * which is the most reliable approach on Android Chrome and Safari. Browsers require a
 * recognition locale, so auto mode uses the browser's locale and lets the server detect
 * the reply language from the resulting transcript.
 */
export function useRecognition({ lang, onInterim, onEnd }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const cb = useRef({});
  cb.current = { onInterim, onEnd, lang };

  const supported = Boolean(SR);
  const secure = typeof window === 'undefined' || window.isSecureContext;

  const start = useCallback(() => {
    if (!SR) {
      setError('Voice input is not supported in this browser. Try Chrome, Edge or Safari.');
      return false;
    }
    if (!secure) {
      setError('The microphone only works on HTTPS or localhost. Open ARNA over a secure connection.');
      return false;
    }
    if (recRef.current) return true;
    setError('');
    const rec = new SR();
    const activeLang = recognitionLanguage(cb.current.lang);
    rec.lang = activeLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let failed = false;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.current.onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      failed = true;
      setError(ERRORS[e.error] || `Voice input error: ${e.error}`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      cb.current.onEnd?.(finalText.trim(), { failed, lang: activeLang });
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      return true;
    } catch {
      recRef.current = null;
      setError('Could not start the microphone. Please try again.');
      return false;
    }
  }, [secure]);

  /** Finish and deliver what was heard. */
  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  /** Cancel without delivering anything. */
  const abort = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onend = null;
    rec.onresult = null;
    rec.onerror = null;
    recRef.current = null;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  useEffect(() => abort, [abort]);

  return { supported, secure, listening, error, setError, start, stop, abort };
}
