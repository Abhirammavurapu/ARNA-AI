import { useEffect } from 'react';
import { Languages, Play, Sparkles, Trash2, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { LANGUAGES } from '../../utils/languages.js';
import { voicesForLang, isKnownFemale } from '../../utils/voices.js';

function Row({ label, hint, children }) {
  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const field = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-violet-400/60 md:text-sm';

export default function SettingsModal({ open, onClose, tts, chatCount, onClearAll }) {
  const { settings, update } = useSettings();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const voiceLang = settings.lang === 'auto' ? 'en-IN' : settings.lang;
  const options = voicesForLang(tts.voices, voiceLang);

  const previewText = {
    'te-IN': 'నమస్కారం! నేను ARNA. మీకు ఎలా సహాయం చేయగలను?',
    'hi-IN': 'नमस्ते! मैं ARNA हूँ। मैं आपकी कैसे मदद कर सकता हूँ?',
  };

  const preview = () => {
    tts.cancel();
    tts.unlock();
    tts.speak(previewText[voiceLang] || `Hi${settings.name ? ` ${settings.name}` : ''}, I'm Arna. This is how I sound.`, { lang: voiceLang });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="scroll-y max-h-[92dvh] w-full max-w-md rounded-t-3xl border border-line bg-side p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface2">
            <X size={20} />
          </button>
        </div>

        <div className="divide-y divide-line">
          <Row label="Your name" hint="ARNA uses it in greetings.">
            <input value={settings.name} onChange={(e) => update({ name: e.target.value.slice(0, 40) })} placeholder="e.g. Abhi" className={field} />
          </Row>

          <Row
            label="Voice input language"
            hint="This selects the microphone's recognition language, not ARNA's reply language. Set it to Hindi for Hindi speech or Telugu for Telugu speech. Auto uses your browser's language and cannot reliably switch languages mid-session."
          >
            <div className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-surface/80 to-cyan-400/10 p-3 shadow-inner shadow-violet-500/5">
              <div className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
                <Languages size={15} /> Speech recognition
              </div>
              <div className="space-y-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${settings.lang === 'auto' ? 'border-violet-400/60 bg-violet-500/15 shadow-md shadow-violet-950/20' : 'border-line/70 bg-black/5 hover:border-cyan-300/40 hover:bg-cyan-400/5'}`}>
                  <input
                    type="radio"
                    name="voice-input-language"
                    value="auto"
                    checked={settings.lang === 'auto'}
                    onChange={() => update({ lang: 'auto', voiceName: '' })}
                    className="mt-0.5 h-4 w-4 accent-violet-500"
                  />
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-300"><Sparkles size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">Auto <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">Default</span></span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">Uses your browser's recognition language; reply follows the transcript.</span>
                  </span>
                </label>

                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${settings.lang !== 'auto' ? 'border-cyan-300/50 bg-cyan-400/10 shadow-md shadow-cyan-950/20' : 'border-line/70 bg-black/5 hover:border-violet-300/40 hover:bg-violet-400/5'}`}>
                  <input
                    type="radio"
                    name="voice-input-language"
                    value="manual"
                    checked={settings.lang !== 'auto'}
                    onChange={() => update({ lang: 'hi-IN', voiceName: '' })}
                    className="mt-0.5 h-4 w-4 accent-cyan-400"
                  />
                  <span className="block text-sm font-semibold">Choose a language <span className="mt-1 block text-xs font-normal text-muted">Choose Hindi or Telugu to improve recognition accuracy.</span></span>
                </label>
              </div>

              {settings.lang !== 'auto' && (
                <div className="ml-4 mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3 sm:ml-11">
                  <label htmlFor="voice-recognition-language" className="mb-1.5 block text-xs font-semibold text-cyan-200">I am speaking</label>
                  <select
                    id="voice-recognition-language"
                    value={settings.lang}
                    onChange={(e) => update({ lang: e.target.value, voiceName: '' })}
                    className={`${field} border-cyan-300/20 bg-[#10172b] focus:border-cyan-300/60`}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Row>

          <Row
            label="ARNA's voice"
            hint={
              !tts.supported
                ? 'Spoken replies are not supported in this browser.'
                : options.length === 0
                  ? settings.lang === 'te-IN'
                    ? 'No Telugu voice is installed on your device. ARNA will use its online Telugu voice instead.'
                    : settings.lang === 'hi-IN'
                      ? 'No Hindi voice is installed on your device. ARNA will use its online Hindi voice instead.'
                    : 'No voice for this language is installed on your device. Install one in your system settings, or pick another language.'
                  : 'Auto picks the best female voice available on your device.'
            }
          >
            <div className="flex gap-2">
              <select value={settings.voiceName} onChange={(e) => update({ voiceName: e.target.value })} className={field} disabled={!tts.supported}>
                <option value="">Auto (female voice)</option>
                {options.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}{isKnownFemale(v) ? ' ♀' : ''}
                  </option>
                ))}
              </select>
              <button onClick={preview} disabled={!tts.supported} aria-label="Preview voice" className="bg-arna grid w-12 shrink-0 place-items-center rounded-xl text-[#070a1c] disabled:opacity-40">
                <Play size={18} fill="currentColor" />
              </button>
            </div>
          </Row>

          <Row label={`Speaking speed · ${settings.rate.toFixed(1)}×`}>
            <input type="range" min="0.7" max="1.4" step="0.1" value={settings.rate} onChange={(e) => update({ rate: Number(e.target.value) })} className="w-full" />
          </Row>

          <Row label="Read every reply aloud" hint="Replies to typed messages are spoken too. Replies to your voice are always spoken.">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
              <span>{settings.autoSpeak ? 'On' : 'Off'}</span>
              <input type="checkbox" checked={settings.autoSpeak} onChange={(e) => update({ autoSpeak: e.target.checked })} className="h-5 w-5 accent-violet-500" />
            </label>
          </Row>

          <Row label="Chat history" hint="Chats are stored only in this browser, never on a server.">
            <button
              disabled={!chatCount}
              onClick={() => window.confirm('Delete all chats from this device?') && onClearAll()}
              className="flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 size={16} /> Delete all chats ({chatCount})
            </button>
          </Row>
        </div>
      </div>
    </div>
  );
}
