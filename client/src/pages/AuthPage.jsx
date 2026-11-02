import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSignup = mode === 'signup';

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (isSignup) await signup(name, email, password);
      else await login(email, password);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const field = 'w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/20';
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070a1c] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(99,102,241,.22),transparent_40%),radial-gradient(ellipse_at_85%_80%,rgba(34,211,238,.13),transparent_38%)]" />
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-violet-950/30 backdrop-blur-xl sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25"><Sparkles size={30} /></div>
          <h1 className="text-3xl font-semibold tracking-tight">ARNA <span className="text-violet-300">AI</span></h1>
          <p className="mt-2 text-sm text-slate-400">{isSignup ? 'Create your personal AI assistant account' : 'Welcome back. Your assistant is waiting.'}</p>
        </div>
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-black/20 p-1 text-sm">
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-lg py-2.5 ${!isSignup ? 'bg-white/10 text-white shadow' : 'text-slate-400'}`}>Log in</button>
          <button type="button" onClick={() => { setMode('signup'); setError(''); }} className={`rounded-lg py-2.5 ${isSignup ? 'bg-white/10 text-white shadow' : 'text-slate-400'}`}>Create account</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {isSignup && <label className="relative block"><UserRound className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input className={field} autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required /></label>}
          <label className="relative block"><Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input className={field} type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="relative block"><LockKeyhole className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input className={`${field} pr-12`} type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="Password (minimum 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} required/><button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-3 text-slate-500 hover:text-white">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 py-3.5 text-sm font-semibold shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{busy ? 'Please wait…' : isSignup ? 'Create my account' : 'Log in to ARNA'} {!busy && <ArrowRight size={17}/>}</button>
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">Your account is protected with a hashed password and a secure, HTTP-only session cookie.</p>
      </motion.section>
    </main>
  );
}
