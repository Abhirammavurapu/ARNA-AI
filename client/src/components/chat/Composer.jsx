import { useEffect, useRef, useState } from 'react';
import { ArrowUp, AudioLines, FolderOpen, ImagePlus, Mic, Square, X } from 'lucide-react';
import { useRecognition } from '../../hooks/useRecognition.js';
import { fileToDataUrl } from '../../utils/image.js';
import { isTouchDevice } from '../../utils/device.js';

const MAX_IMAGES = 3;

export default function Composer({ busy, lang, onSend, onStop, onGesture, onOpenLive, liveDisabled }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [interim, setInterim] = useState('');
  const [notice, setNotice] = useState('');
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const draft = useRef({ text: '', images: [] });
  draft.current = { text, images };

  const rec = useRecognition({
    lang,
    onInterim: setInterim,
    onEnd: (finalText, { lang: recognitionLang } = {}) => {
      setInterim('');
      if (!finalText) return;
      const { text: typed, images: imgs } = draft.current;
      // Talking to ARNA sends straight away and the reply is spoken back.
      onSend(`${typed} ${finalText}`.trim(), imgs, { fromVoice: true, lang: recognitionLang });
      setText('');
      setImages([]);
    },
  });

  // Auto-grow textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const addFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) {
      if (files.length) setNotice('Folders can be attached when they contain images.');
      return;
    }
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return setNotice(`You can attach up to ${MAX_IMAGES} images.`);
    try {
      const urls = await Promise.all(list.slice(0, room).map(fileToDataUrl));
      setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
      if (list.length > room) setNotice(`Attached ${room} images. You can attach up to ${MAX_IMAGES} images per message.`);
    } catch (err) {
      setNotice(err.message);
    }
  };

  const submit = () => {
    if (busy) return;
    if (!text.trim() && !images.length) return;
    onGesture?.();
    onSend(text, images, {});
    setText('');
    setImages([]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchDevice()) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const toggleMic = () => {
    if (rec.listening) {
      rec.stop();
      return;
    }
    onGesture?.();
    rec.start();
  };

  const error = rec.error || notice;
  const canSend = text.trim() || images.length;

  return (
    <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {error && (
          <div role="alert" className="mb-2 flex items-start justify-between gap-2 rounded-2xl bg-red-500/15 px-3.5 py-2 text-sm text-red-300">
            <span>{error}</span>
            <button
              onClick={() => {
                rec.setError('');
                setNotice('');
              }}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="glass glass-blur rounded-[28px] px-3 pb-2 pt-2.5 shadow-lg shadow-black/20 focus-within:border-violet-400/50">
          {images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-1">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="Attachment preview" className="h-16 w-16 rounded-xl border border-line object-cover" />
                  <button
                    onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                    aria-label="Remove image"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {rec.listening ? (
            <div className="flex min-h-[44px] items-center gap-2 px-2 text-[0.95rem] text-cyan-300">
              <span className="typing shrink-0"><span /><span /><span /></span>
              <span className="min-w-0 truncate text-fg/90">{interim || 'Listening… speak now'}</span>
            </div>
          ) : (
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={1}
              enterKeyHint="send"
              placeholder="Ask ARNA anything…"
              aria-label="Message ARNA"
              className="block max-h-[180px] min-h-[44px] w-full resize-none bg-transparent px-2 py-2.5 text-[16px] leading-6 outline-none placeholder:text-muted"
            />
          )}
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={folderRef} type="file" accept="image/*" multiple webkitdirectory="" directory="" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Attach image"
              title="Attach image"
              className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-fg"
            >
              <ImagePlus size={20} />
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              aria-label="Attach images from folder"
              title="Attach images from folder"
              className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-fg"
            >
              <FolderOpen size={19} />
            </button>
            <div className="flex-1" />
            <button
              onClick={onOpenLive}
              disabled={liveDisabled}
              aria-label="Start a live voice conversation"
              title="Live voice conversation"
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg disabled:opacity-40"
            >
              <AudioLines size={20} />
              <span className="hidden sm:inline">Live</span>
            </button>
            <button
              onClick={toggleMic}
              disabled={!rec.supported}
              aria-label={rec.listening ? 'Stop listening' : 'Speak to ARNA'}
              title={rec.supported ? 'Speak to ARNA' : 'Voice input is not supported in this browser'}
              className={`relative grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-40 ${rec.listening ? 'mic-pulse bg-cyan-400 text-[#070a1c]' : 'text-muted hover:bg-surface2 hover:text-fg'}`}
            >
              <Mic size={20} />
            </button>
            {busy ? (
              <button onClick={onStop} aria-label="Stop generating" className="grid h-10 w-10 place-items-center rounded-full bg-fg text-bg">
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className="bg-arna grid h-10 w-10 place-items-center rounded-full text-[#070a1c] transition disabled:opacity-30"
              >
                <ArrowUp size={20} strokeWidth={2.6} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted">ARNA can make mistakes. Double-check important information.</p>
      </div>
    </div>
  );
}
