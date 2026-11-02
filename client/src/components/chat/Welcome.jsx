import { Activity, BriefcaseBusiness, MessageCircle, Mic, Code2, Lightbulb, PenLine, Compass } from 'lucide-react';
import Orb from '../assistant3d/Orb.jsx';

const MODES = [
  {
    id: 'health', icon: Activity, title: 'Health Assistant', subtitle: 'Wellness, food, fitness and sleep guidance',
    prompt: 'Act as my health and wellness assistant. Help me build healthy daily habits. Ask what you need to know first.',
    tint: 'from-emerald-400/20 to-cyan-400/5',
  },
  {
    id: 'interview', icon: BriefcaseBusiness, title: 'Interview Preparation', subtitle: 'Technical questions, HR practice and mock interviews',
    prompt: 'Act as my interview coach. I am preparing for fresher IT roles. Start a mock interview by asking me one question at a time and give feedback on my answers.',
    tint: 'from-violet-400/20 to-fuchsia-400/5',
  },
  {
    id: 'friendly', icon: MessageCircle, title: 'Friendly Chat', subtitle: 'Talk naturally about anything, in Telugu or English',
    prompt: 'Hi ARNA! Let us have a friendly conversation. Be warm and natural.',
    tint: 'from-cyan-400/20 to-blue-400/5',
  },
  {
    id: 'friendly', icon: Mic, title: 'Voice Assistant', subtitle: 'Talk to ARNA using your microphone',
    prompt: 'Hello ARNA! I want to talk with you using voice.',
    tint: 'from-pink-400/20 to-violet-400/5',
    voice: true,
  },
];

const SUGGESTIONS = [
  { icon: Lightbulb, text: 'Explain a difficult topic in simple words' },
  { icon: Code2, text: 'Help me practise JavaScript interview questions' },
  { icon: PenLine, text: 'Help me prepare a confident self-introduction' },
  { icon: Compass, text: 'Suggest a healthy daily routine' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Hello';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Welcome({ name, orbState, showOrb, onPick }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-4 py-6 text-center sm:px-6">
      <div className="w-36 sm:w-44">{showOrb ? <Orb state={orbState} /> : <div className="aspect-square" />}</div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Your personal AI companion</p>
      <h1 className="mt-2 text-[2rem] font-semibold leading-tight sm:text-5xl">
        <span className="text-gradient">{greeting()}{name ? `, ${name}` : ''}</span>
      </h1>
      <p className="mt-2 text-lg text-muted sm:text-xl">What would you like to do today?</p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {MODES.map(({ id, icon: Icon, title, subtitle, prompt, tint, voice }) => (
          <button key={title} onClick={() => (voice ? onPick('', id, true) : onPick(prompt, id))} className={`group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${tint} p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-violet-300/40 hover:shadow-xl hover:shadow-violet-950/20`}>
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5 blur-2xl transition group-hover:scale-150" />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/15 text-cyan-200"><Icon size={21} /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-fg">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{subtitle}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200">{voice ? 'Start a voice chat' : 'Start now'} <span aria-hidden="true">→</span></span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 w-full">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Quick ideas</p>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map(({ icon: Icon, text }) => (
            <button key={text} onClick={() => onPick(text, 'friendly')} className="glass flex items-start gap-3 rounded-xl p-3 text-left text-sm transition hover:bg-surface2 active:scale-[0.99]">
              <Icon size={17} className="mt-0.5 shrink-0 text-violet-300" /><span>{text}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-6 text-xs text-muted">ARNA supports Telugu and English conversations. Choose Telugu in Settings for Telugu speech recognition.</p>
    </div>
  );
}
