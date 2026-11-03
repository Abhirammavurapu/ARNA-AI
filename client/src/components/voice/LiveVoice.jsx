import { useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import Orb from '../assistant3d/Orb.jsx';
import { useRecognition } from '../../hooks/useRecognition.js';
import { createSentenceSplitter } from '../../utils/speech.js';

const LABEL = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  paused: 'Tap the orb to talk',
  idle: 'Getting ready…',
};

/**
 * Hands-free voice conversation, like Gemini Live: listen → think → speak → listen again.
 * Tap the orb at any time to interrupt ARNA or to stop listening and send what you said.
 */
export default function LiveVoice({ onClose, chat, tts, lang, name }) {
  const [phase, setPhase] = useState('idle');
  const [heard, setHeard] = useState('');
  const [caption, setCaption] = useState('');
  const [err, setErr] = useState('');
  const alive = useRef(true);
  const empties = useRef(0);

  const rec = useRecognition({ lang, onInterim: setHeard, onEnd: handleEnd });

  function listen() {
    if (!alive.current) return;
    setHeard('');
    tts.cancel();
    setPhase(rec.start() ? 'listening' : 'paused');
  }

  function handleEnd(text, { failed }) {
    if (!alive.current) return;
    if (failed) return setPhase('paused');
    if (!text) {
      empties.current += 1;
      // Stay quiet after a few silent rounds instead of draining the battery.
      return empties.current >= 3 ? setPhase('paused') : listen();
    }
    empties.current = 0;
    respond(text);
  }

  function respond(text) {
    setPhase('thinking');
    setHeard(text);
    setCaption('');
    setErr('');
    let spoke = false;
    let full = '';
    const splitter = createSentenceSplitter((sentence) => {
      if (!alive.current) return;
      tts.speak(sentence);
      if (!spoke) {
        spoke = true;
        setPhase('speaking');
      }
    });
    chat.send(text, [], {
      voice: true,
      lang,
      name,
      onDelta: (d) => {
        full += d;
        splitter.push(d);
        setCaption(full);
      },
      onDone: () => {
        splitter.flush();
        if (!alive.current) return;
        if (!spoke) return listen();
        tts.whenDone(() => alive.current && listen());
      },
      onError: (e) => {
        if (!alive.current) return;
        setErr(e.message);
        setPhase('paused');
      },
    });
  }

  useEffect(() => {
    alive.current = true;
    tts.unlock();
    listen();
    return () => {
      alive.current = false;
      rec.abort();
      tts.cancel();
      chat.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapOrb = () => {
    empties.current = 0;
    if (phase === 'listening') return rec.stop();
    chat.stop();
    tts.cancel();
    listen();
  };

  const state = phase === 'listening' || phase === 'thinking' || phase === 'speaking' ? phase : 'idle';
  const shown = err || rec.error || tts.error;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg" style={{ background: 'radial-gradient(60rem 40rem at 50% 30%, var(--glow-1), transparent 65%), var(--bg)' }} role="dialog" aria-modal="true" aria-label="Live voice conversation">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="glass rounded-full px-3 py-1.5 text-xs font-medium text-muted">Live · {lang}</span>
        <button onClick={onClose} aria-label="End live conversation" className="grid h-11 w-11 place-items-center rounded-full bg-surface2 hover:bg-white/20">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <button onClick={tapOrb} aria-label={LABEL[phase]} className="w-[min(76vw,22rem)] rounded-full outline-none">
          <Orb state={state} />
        </button>
        <div className="flex items-center gap-2 text-lg font-medium" aria-live="polite">
          {phase === 'paused' && <Mic size={18} />}
          <span className="text-gradient">{LABEL[phase]}</span>
        </div>
        <div className="min-h-[5.5rem] max-w-xl space-y-2 text-[0.95rem]">
          {heard && <p className="text-muted">“{heard}”</p>}
          {caption && <p className="line-clamp-4 text-fg">{caption.slice(-260)}</p>}
          {shown && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-300">{shown}</p>}
        </div>
      </div>

      <p className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">
        Speak naturally. Tap the orb to interrupt ARNA or to send early.
      </p>
    </div>
  );
}
