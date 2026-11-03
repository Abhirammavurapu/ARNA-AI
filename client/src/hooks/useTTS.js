
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { pickVoice, isKnownFemale } from '../utils/voices.js';
import { chunkForSpeech } from '../utils/speech.js';
import { API_BASE } from '../services/chatApi.js';

const synth =
  typeof window !== 'undefined'
    ? window.speechSynthesis
    : undefined;
const AudioContextClass =
  typeof window !== 'undefined'
    ? window.AudioContext || window.webkitAudioContext
    : undefined;
const audioSupported = typeof Audio !== 'undefined';

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
  const supported = Boolean(synth || audioSupported);

  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  const queue = useRef([]);
  const active = useRef(false);
  const generation = useRef(0);
  const waiters = useRef([]);
  const watchdog = useRef(0);
  const audioContext = useRef(null);
  const audioSource = useRef(null);
  const audioElement = useRef(null);
  const audioUrl = useRef('');
  const audioRequest = useRef(null);

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

  const pump = useCallback(function pumpSpeech() {
    if ((!synth && !audioSupported) || active.current) return;

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

    let finished = false;

    const next = () => {
      if (finished || gen !== generation.current) return;

      finished = true;

      clearTimeout(watchdog.current);

      if (audioRequest.current) {
        audioRequest.current.abort();
        audioRequest.current = null;
      }
      if (audioSource.current) {
        audioSource.current.onended = null;
        try {
          audioSource.current.stop();
        } catch {
          // The source may have already stopped.
        }
        audioSource.current = null;
      }
      if (audioElement.current) {
        audioElement.current.onended = null;
        audioElement.current.onerror = null;
        audioElement.current.pause();
        audioElement.current = null;
      }
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = '';
      }

      active.current = false;

      pumpSpeech();
    };

    let fallbackStarted = false;
    const playTeluguFallback = () => {
      if (fallbackStarted || finished) return;
      fallbackStarted = true;

      const controller = new AbortController();
      audioRequest.current = controller;
      clearTimeout(watchdog.current);
      watchdog.current = setTimeout(() => {
        setError('Telugu voice generation timed out. Please try again.');
        next();
      }, 60000);

      fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender: 'female' }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || 'Telugu voice generation failed.');
          }
          return response.blob();
        })
        .then(async (audioBlob) => {
          if (gen !== generation.current) return;

          const context = audioContext.current;
          if (context && AudioContextClass) {
            try {
              if (context.state === 'suspended') await context.resume();
              const buffer = await context.decodeAudioData(await audioBlob.arrayBuffer());
              if (gen !== generation.current) return;
              const source = context.createBufferSource();
              source.buffer = buffer;
              source.connect(context.destination);
              source.onended = next;
              audioSource.current = source;
              source.start();
              return;
            } catch {
              if (gen !== generation.current) return;
            }
          }

          audioUrl.current = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl.current);
          audioElement.current = audio;
          audio.onended = next;
          audio.onerror = () => {
            setError('Could not play Telugu audio. Check your device volume and try again.');
            next();
          };
          return audio.play();
        })
        .catch((playbackError) => {
          if (playbackError.name === 'AbortError' || gen !== generation.current) return;
          setError(playbackError.message || 'Could not play the Telugu voice reply.');
          next();
        });
    };

    if (language === 'te-IN' && !selectedVoice && audioSupported) {
      playTeluguFallback();
      return;
    }

    if (!synth) {
      setError('Speech output is not supported in this browser.');
      next();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

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
    utterance.onend = next;
    utterance.onerror = () => {
      if (language === 'te-IN' && audioSupported) {
        synth.cancel();
        playTeluguFallback();
        return;
      }
      setError('Speech playback failed. Check your device audio settings.');
      next();
    };

    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(
      () => {
        if (language === 'te-IN' && audioSupported) {
          synth.cancel();
          playTeluguFallback();
          return;
        }
        next();
      },
      4000 + (text.length * 120) / Math.max(0.5, speechRate)
    );

    try {
      synth.speak(utterance);
    } catch {
      setError('Speech playback failed. Check your device audio settings.');
      next();
    }
  }, [settle]);

  // Unlock browser speech after a user interaction
  const unlock = useCallback(() => {
    try {
      if (AudioContextClass && !audioContext.current) {
        audioContext.current = new AudioContextClass();
      }
      if (audioContext.current?.state === 'suspended') {
        audioContext.current.resume().catch(() => {});
      }
    } catch {
      audioContext.current = null;
    }
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
    (text, _options = {}) => {
      if ((!synth && !audioSupported) || !text || !String(text).trim()) return;

      setError('');

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
    audioRequest.current?.abort();
    audioRequest.current = null;
    if (audioSource.current) {
      try {
        audioSource.current.stop();
      } catch {
        // The source may have already stopped.
      }
    }
    audioSource.current = null;
    audioElement.current?.pause();
    audioElement.current = null;
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = '';
    }

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
    return () => {
      cancel();
      audioContext.current?.close();
      audioContext.current = null;
    };
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
    error,
    speak,
    cancel,
    unlock,
    whenDone
  };
}
