import { useState } from 'react';
import { Check, MessageSquare, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, X } from 'lucide-react';
import Logo from '../common/Logo.jsx';

function ChatRow({ chat, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);

  const save = () => {
    onRename(chat.id, title);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-1">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none"
          aria-label="Chat title"
        />
        <button onClick={save} aria-label="Save title" className="p-1 text-muted hover:text-fg"><Check size={16} /></button>
        <button onClick={() => setEditing(false)} aria-label="Cancel" className="p-1 text-muted hover:text-fg"><X size={16} /></button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center rounded-full pr-1 ${active ? 'bg-surface2' : 'hover:bg-surface'}`}>
      <button onClick={() => onSelect(chat.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-sm">
        <MessageSquare size={15} className="shrink-0 text-muted" />
        <span className="truncate">{chat.title}</span>
      </button>
      <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button onClick={() => { setTitle(chat.title); setEditing(true); }} aria-label="Rename chat" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-fg">
          <Pencil size={14} />
        </button>
        <button
          onClick={() => window.confirm(`Delete "${chat.title}"?`) && onDelete(chat.id)}
          aria-label="Delete chat"
          className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose, chats, activeId, onNew, onSelect, onDelete, onRename, onSettings, theme, onToggleTheme }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = q ? chats.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))) : chats;

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-30 bg-black/55 md:hidden" aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[84vw] max-w-[320px] flex-col border-r border-line bg-side transition-transform duration-200 md:relative md:z-auto md:max-w-none md:translate-x-0 md:transition-[width] ${
          open ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-0 md:overflow-hidden md:border-r-0'
        }`}
        aria-label="Chat history"
      >
        <div className="flex w-full min-w-[17rem] flex-1 flex-col overflow-hidden p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="text-lg font-semibold tracking-wide">ARNA</span>
            </div>
            <button onClick={onClose} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface2 md:hidden">
              <X size={20} />
            </button>
          </div>

          <button onClick={onNew} className="mb-3 flex items-center gap-2 rounded-full bg-surface2 px-4 py-2.5 text-sm font-medium hover:bg-white/15">
            <Plus size={18} /> New chat
          </button>

          <label className="glass mb-2 flex items-center gap-2 rounded-full px-3 py-2 text-sm">
            <Search size={15} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted md:text-sm"
            />
          </label>

          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted">Recent</p>
          <nav className="scroll-y -mr-1 flex-1 space-y-0.5 pr-1">
            {list.length === 0 && <p className="px-3 py-4 text-sm text-muted">{q ? 'No chats match.' : 'Your conversations will appear here.'}</p>}
            {list.map((c) => (
              <ChatRow key={c.id} chat={c} active={c.id === activeId} onSelect={onSelect} onDelete={onDelete} onRename={onRename} />
            ))}
          </nav>

          <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
            <button onClick={onSettings} className="flex flex-1 items-center gap-2.5 rounded-full px-3 py-2.5 text-sm hover:bg-surface">
              <Settings size={17} /> Settings
            </button>
            <button onClick={onToggleTheme} aria-label="Toggle light and dark theme" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
