import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, LogOut, Menu, Plus, Square } from 'lucide-react';
import { useSettings } from './context/SettingsContext.jsx';
import { useChats } from './hooks/useChats.js';
import { useTTS } from './hooks/useTTS.js';
import { getStatus } from './services/chatApi.js';
import { cleanForSpeech, createSentenceSplitter } from './utils/speech.js';
import Sidebar from './components/layout/Sidebar.jsx';
import SettingsModal from './components/layout/SettingsModal.jsx';
import Welcome from './components/chat/Welcome.jsx';
import Message from './components/chat/Message.jsx';
import Composer from './components/chat/Composer.jsx';
import LiveVoice from './components/voice/LiveVoice.jsx';
import Logo from './components/common/Logo.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';

const NO_MESSAGES = [];

export default function App() {
  const { settings, update } = useSettings();
  const { user, loading: authLoading, logout } = useAuth();
  const chat = useChats(user?.id || null);
  const { send, regenerate } = chat;
  const tts = useTTS({ lang: settings.lang, voiceName: settings.voiceName, rate: settings.rate });

  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [server, setServer] = useState({ state: 'checking' });
  const [assistantMode, setAssistantMode] = useState('friendly');

  // Server status (also fixes the old landing page, which called a route that did not exist).
  useEffect(() => {
    const ctl = new AbortController();
    getStatus(ctl.signal)
      .then((s) => setServer({ state: 'ok', ...s }))
      .catch((e) => e.name !== 'AbortError' && setServer({ state: 'down' }));
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    if (chat.active?.mode) setAssistantMode(chat.active.mode);
  }, [chat.activeId, chat.active?.mode]);

  const messages = chat.active?.messages ?? NO_MESSAGES;
  const lastIsStreaming = messages.at(-1)?.streaming;

  // --- sending (with optional spoken reply) --------------------------------
  const handleSend = useCallback(
    (text, images = [], { fromVoice = false, mode = assistantMode } = {}) => {
      const speak = fromVoice || settings.autoSpeak;
      let splitter;
      if (speak && tts.supported) {
        tts.cancel();
        tts.unlock();
        setSpeakingId(null);
        splitter = createSentenceSplitter((s) => tts.speak(s));
      }
      return send(text, images, {
        voice: fromVoice,
        lang: settings.lang,
        name: settings.name,
        mode,
        onDelta: (d) => splitter?.push(d),
        onDone: () => splitter?.flush(),
      });
    },
    [send, settings.autoSpeak, settings.lang, settings.name, tts, assistantMode]
  );

  const handleRegenerate = useCallback(() => {
    tts.cancel();
    setSpeakingId(null);
    let splitter;
    if (settings.autoSpeak && tts.supported) splitter = createSentenceSplitter((s) => tts.speak(s));
    regenerate({
      lang: settings.lang,
      name: settings.name,
      mode: assistantMode,
      onDelta: (d) => splitter?.push(d),
      onDone: () => splitter?.flush(),
    });
  }, [regenerate, settings.autoSpeak, settings.lang, settings.name, tts, assistantMode]);

  // --- read aloud per message ---------------------------------------------
  const readAloud = useCallback(
    (m) => {
      tts.cancel();
      tts.unlock();
      setSpeakingId(m.id);
      tts.speak(cleanForSpeech(m.content));
      tts.whenDone(() => setSpeakingId((id) => (id === m.id ? null : id)));
    },
    [tts]
  );
  const stopReading = useCallback(() => {
    tts.cancel();
    setSpeakingId(null);
  }, [tts]);

  // --- scrolling: follow the stream unless the user scrolled up -------------
  const scrollRef = useRef(null);
  const stick = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    if (stick.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    stick.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.activeId]);

  const closeSidebarOnMobile = () => window.matchMedia('(max-width: 767px)').matches && setSidebarOpen(false);
  const orbState = chat.busy ? 'thinking' : tts.speaking ? 'speaking' : 'idle';

  const lastAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant')?.id, [messages]);

  if (authLoading) return <div className="grid h-screen place-items-center bg-[#070a1c] text-slate-300">Loading ARNA…</div>;
  if (!user) return <AuthPage />;

  return (
    <div className="app-shell flex overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chat.chats}
        activeId={chat.activeId}
        onNew={() => { chat.newChat(); setAssistantMode('friendly'); closeSidebarOnMobile(); }}
        onSelect={(id) => { chat.selectChat(id); setAssistantMode('friendly'); closeSidebarOnMobile(); }}
        onDelete={chat.deleteChat}
        onRename={chat.renameChat}
        onSettings={() => { setSettingsOpen(true); closeSidebarOnMobile(); }}
        theme={settings.theme}
        onToggleTheme={() => update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-line/60 bg-bg/70 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 md:bg-transparent">
          <button onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface2">
            <Menu size={22} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {!sidebarOpen && <Logo size={24} />}
            <span className="truncate text-[0.95rem] font-medium text-muted">{chat.active ? chat.active.title : 'ARNA'}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted"><span className="hidden sm:inline">{user.name}</span><button onClick={async () => { tts.cancel(); await logout(); }} title="Log out" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface2"><LogOut size={17}/></button></div>
          {tts.speaking && !liveOpen && (
            <button onClick={stopReading} className="flex items-center gap-1.5 rounded-full bg-pink-500/20 px-3 py-1.5 text-xs font-medium text-pink-300">
              <Square size={11} fill="currentColor" /> Stop speaking
            </button>
          )}
          {chat.active && (
            <button onClick={chat.newChat} aria-label="New chat" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface2">
              <Plus size={22} />
            </button>
          )}
        </header>

        {server.state === 'down' && (
          <Banner>Can't reach the ARNA server. Start it with <code>npm run dev</code> and refresh.</Banner>
        )}
        {server.state === 'ok' && !server.aiConfigured && (
          <Banner>
            No AI key is set on the server yet. Add <code>GEMINI_API_KEY</code> (free) to <code>server/.env</code> and restart.
          </Banner>
        )}
        {tts.error && <Banner>{tts.error}</Banner>}

        <div ref={scrollRef} onScroll={onScroll} className="scroll-y min-h-0 flex-1 overscroll-y-contain">
          {chat.active ? (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-4 sm:px-6">
              {messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  isLast={m.id === lastAssistantId && !lastIsStreaming}
                  speaking={speakingId === m.id && tts.speaking}
                  canSpeak={tts.supported}
                  onSpeak={readAloud}
                  onStopSpeak={stopReading}
                  onRegenerate={handleRegenerate}
                />
              ))}
            </div>
          ) : (
            <Welcome name={settings.name} orbState={orbState} showOrb={!liveOpen} onPick={(t, mode = 'friendly', voice = false) => { setAssistantMode(mode); if (voice) setLiveOpen(true); else handleSend(t, [], { mode }); }} />
          )}
        </div>

        <div className="z-10 shrink-0 bg-gradient-to-t from-bg via-bg/95 to-transparent">
        <Composer
          busy={chat.busy}
          lang={settings.lang}
          onSend={handleSend}
          onStop={() => { chat.stop(); tts.cancel(); }}
          onGesture={() => { tts.cancel(); tts.unlock(); }}
          onOpenLive={() => setLiveOpen(true)}
          liveDisabled={!tts.supported}
        />
        </div>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} tts={tts} chatCount={chat.chats.length} onClearAll={chat.clearAll} />
      {liveOpen && <LiveVoice onClose={() => setLiveOpen(false)} chat={chat} tts={tts} lang={settings.lang} name={settings.name} />}
    </div>
  );
}

function Banner({ children }) {
  return (
    <div className="mx-3 mb-1 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-200 sm:mx-6 [&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
