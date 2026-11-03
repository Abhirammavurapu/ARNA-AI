import { Activity, BriefcaseBusiness, MessageCircle, Mic, Code2, Lightbulb, PenLine, Compass, Sparkles } from 'lucide-react';
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
    <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center overflow-hidden px-4 py-5 text-center sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute left-1/2 top-10 h-48 w-72 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl sm:top-16 sm:h-64 sm:w-[30rem]" />
      <div className="relative w-32 sm:w-44">{showOrb ? <Orb state={orbState} /> : <div className="aspect-square" />}</div>
      <div className="relative mt-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">
        <Sparkles size={13} /> Your personal AI companion
      </div>
      <h1 className="relative mt-3 text-[1.8rem] font-semibold leading-tight sm:mt-4 sm:text-5xl">
        <span className="text-gradient">{greeting()}{name ? `, ${name}` : ''}</span>
      </h1>
      <p className="relative mt-2 max-w-md text-sm text-muted sm:text-xl">A little curiosity can go a long way. What can I help you with?</p>

      <div className="mt-6 grid w-full grid-cols-1 gap-3 text-left sm:mt-8 sm:grid-cols-2">
        {MODES.map(({ id, icon: Icon, title, subtitle, prompt, tint, voice }) => (
          <button key={title} onClick={() => (voice ? onPick('', id, true) : onPick(prompt, id))} className={`group relative isolate overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-br ${tint} p-4 text-left shadow-lg shadow-black/10 transition duration-200 active:scale-[0.99] hover:-translate-y-1 hover:border-violet-300/40 hover:shadow-xl hover:shadow-violet-950/20 sm:p-5`}>
            <div className="pointer-events-none absolute -right-7 -top-10 -z-10 h-36 w-36 rounded-full bg-white/[0.07] blur-2xl transition duration-500 group-hover:scale-150" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/15 text-cyan-200 shadow-inner shadow-white/5"><Icon size={21} /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-fg">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{subtitle}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200">{voice ? 'Start a voice chat' : 'Explore'} <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 w-full sm:mt-8">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs">A few ideas to get started</p>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map(({ icon: Icon, text }) => (
            <button key={text} onClick={() => onPick(text, 'friendly')} className="glass group flex min-h-12 items-center gap-3 rounded-xl p-3 text-left text-sm transition hover:border-violet-300/30 hover:bg-surface2 active:scale-[0.99]">
              <Icon size={17} className="shrink-0 text-violet-300 transition-transform group-hover:scale-110" /><span>{text}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-5 pb-2 text-[11px] text-muted">Made to help you think, create and learn.</p>
    </div>
  );
}
