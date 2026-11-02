import { memo, useState } from 'react';
import { AlertTriangle, Check, Copy, ImageIcon, RefreshCw, Square, Volume2 } from 'lucide-react';
import Markdown from './Markdown.jsx';
import Logo from '../common/Logo.jsx';

function IconBtn({ label, onClick, children, active }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-fg ${active ? 'bg-surface2 text-fg' : ''}`}
    >
      {children}
    </button>
  );
}

function ErrorCard({ error, onRetry }) {
  const setup = error.code === 'AI_NOT_CONFIGURED';
  return (
    <div className="mt-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
      <div className="mb-1 flex items-center gap-2 font-semibold text-amber-300">
        <AlertTriangle size={16} />
        {setup ? 'ARNA needs an AI key' : 'Something went wrong'}
      </div>
      <p className="text-fg/90">{error.message}</p>
      {setup && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>
            Get a free key at <span className="text-fg">aistudio.google.com/apikey</span>
          </li>
          <li>
            Put it in <code className="rounded bg-surface2 px-1">server/.env</code> as <code className="rounded bg-surface2 px-1">GEMINI_API_KEY=…</code>
          </li>
          <li>Restart the server, then try again.</li>
        </ol>
      )}
      {onRetry && (
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 font-medium hover:bg-white/20">
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

function Message({ message, isLast, speaking, canSpeak, onSpeak, onStopSpeak, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    const imgs = message.images || [];
    return (
      <div className="fade-up flex justify-end">
        <div className="max-w-[88%] sm:max-w-[75%]">
          {imgs.length > 0 && (
            <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
              {imgs.map((src, i) => (
                <img key={i} src={src} alt="Attached" className="max-h-52 rounded-2xl border border-line object-cover" />
              ))}
            </div>
          )}
          {!imgs.length && message.hadImages > 0 && (
            <div className="mb-1.5 flex justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-muted">
                <ImageIcon size={12} /> {message.hadImages} image{message.hadImages > 1 ? 's' : ''} (not stored)
              </span>
            </div>
          )}
          {message.content && (
            <div className="whitespace-pre-wrap rounded-3xl rounded-br-lg bg-surface2 px-4 py-2.5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]">
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const waiting = message.streaming && !message.content;

  return (
    <div className="fade-up flex gap-3">
      <div className="mt-1 shrink-0">
        <Logo size={28} />
      </div>
      <div className="min-w-0 flex-1">
        {waiting ? (
          <div className="typing py-3" aria-label="ARNA is thinking">
            <span /><span /><span />
          </div>
        ) : (
          message.content && <Markdown text={message.content} streaming={message.streaming} />
        )}
        {message.error && <ErrorCard error={message.error} onRetry={isLast ? onRegenerate : undefined} />}
        {message.stopped && <p className="mt-1 text-xs text-muted">Stopped</p>}
        {!message.streaming && message.content && (
          <div className="mt-2 flex items-center gap-0.5">
            <IconBtn label={copied ? 'Copied' : 'Copy'} onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </IconBtn>
            {canSpeak && (
              <IconBtn label={speaking ? 'Stop reading' : 'Read aloud'} onClick={speaking ? onStopSpeak : () => onSpeak(message)} active={speaking}>
                {speaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}
              </IconBtn>
            )}
            {isLast && (
              <IconBtn label="Regenerate" onClick={onRegenerate}>
                <RefreshCw size={16} />
              </IconBtn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Message);
