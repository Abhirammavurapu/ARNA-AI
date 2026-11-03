import { useEffect } from 'react';
import { Play, Trash2, X } from 'lucide-react';
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

  const options = voicesForLang(tts.voices, settings.lang);

  const preview = () => {
    tts.cancel();
    tts.unlock();
    tts.speak(settings.lang === 'te-IN' ? 'నమస్కారం! నేను ARNA. మీకు ఎలా సహాయం చేయగలను?' : `Hi${settings.name ? ` ${settings.name}` : ''}, I'm Arna. This is how I sound.`, { lang: settings.lang });
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

          <Row label="Voice input language" hint="Choose Telugu when speaking Telugu. Browser speech recognition cannot reliably auto-detect mixed languages. ARNA detects Telugu text and speaks Telugu replies automatically.">
            <select value={settings.lang} onChange={(e) => update({ lang: e.target.value, voiceName: '' })} className={field}>
              <option value="te-IN">తెలుగు (Telugu)</option>
              <option value="en-IN">English (India)</option>
              {LANGUAGES.filter((l) => !['te-IN', 'en-IN'].includes(l.code)).map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </Row>

          <Row
            label="ARNA's voice"
            hint={
              !tts.supported
                ? 'Spoken replies are not supported in this browser.'
                : options.length === 0
                  ? settings.lang === 'te-IN'
                    ? 'No Telugu voice is installed on your device. ARNA will use its online Telugu voice instead.'
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
