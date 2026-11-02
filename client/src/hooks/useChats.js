import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { streamChat } from '../services/chatApi.js';

const KEY = 'arna.chats.v1';
const storageKey = (userId) => `${KEY}:${userId || 'guest'}`;
const MAX_CHATS = 60;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function load(userId) {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(data)
      ? data.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, streaming: false })) }))
      : [];
  } catch {
    return [];
  }
}

function persist(chats, userId) {
  // Attached images are kept in memory only (localStorage is small); remember that there was one.
  const slim = chats.slice(0, MAX_CHATS).map((c) => ({
    ...c,
    messages: c.messages.map(({ images, streaming: _streaming, ...m }) => ({
      ...m,
      ...(images?.length ? { hadImages: images.length } : {}),
    })),
  }));
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(slim));
  } catch {
    // Quota exceeded: drop the oldest chats and retry once.
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(slim.slice(0, 15)));
    } catch {
      /* give up silently; chat still works in memory */
    }
  }
}

const titleFrom = (text) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 42 ? `${t.slice(0, 42).trim()}…` : t || 'New chat';
};

/**
 * Chat store + streaming controller. `chatsRef` is the source of truth so async stream callbacks
 * never see stale state; `setChats` just triggers a re-render.
 */
export function useChats(userId) {
  const chatsRef = useRef(load(userId));
  const [chats, setChats] = useState(chatsRef.current);
  const userIdRef = useRef(userId);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const saveTimer = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (userIdRef.current === userId) return;
    abortRef.current?.abort();
    userIdRef.current = userId;
    const next = load(userId);
    chatsRef.current = next;
    setChats(next);
    setActiveId(null);
    setBusy(false);
  }, [userId]);

  const commit = useCallback((next, { save = true } = {}) => {
    chatsRef.current = next;
    setChats(next);
    if (save) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(chatsRef.current, userIdRef.current), 400);
    }
  }, []);

  useEffect(() => {
    const flush = () => persist(chatsRef.current, userIdRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const patchMessage = useCallback(
    (chatId, msgId, patch, opts) => {
      commit(
        chatsRef.current.map((c) =>
          c.id !== chatId
            ? c
            : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
        ),
        opts
      );
    },
    [commit]
  );

  /** Stream a reply for the conversation up to (and including) the last user message. */
  const run = useCallback(
    async (chatId, { voice = false, lang = 'en-US', name = '', mode = 'friendly', onDelta, onDone, onError } = {}) => {
      const chat = chatsRef.current.find((c) => c.id === chatId);
      const history = chat.messages.map((m) => ({ role: m.role, content: m.content, images: m.images || [] }));
      const reply = { id: uid(), role: 'assistant', content: '', streaming: true };
      commit(
        chatsRef.current.map((c) => (c.id === chatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, reply] } : c))
      );

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      let text = '';
      let pending = '';
      const flush = () => {
        raf.current = 0;
        if (!pending) return;
        text += pending;
        pending = '';
        patchMessage(chatId, reply.id, { content: text }, { save: false });
      };

      try {
        await streamChat({
          messages: history,
          voice,
          lang,
          name,
          mode,
          signal: controller.signal,
          onDelta: (d) => {
            pending += d;
            onDelta?.(d);
            // Batch UI updates to one per frame: much smoother on phones.
            if (!raf.current) raf.current = requestAnimationFrame(flush);
          },
        });
        cancelAnimationFrame(raf.current);
        flush();
        patchMessage(chatId, reply.id, { streaming: false });
        onDone?.(text);
      } catch (err) {
        cancelAnimationFrame(raf.current);
        flush();
        if (err.name === 'AbortError') {
          patchMessage(chatId, reply.id, { streaming: false, stopped: true });
        } else {
          patchMessage(chatId, reply.id, {
            streaming: false,
            error: { message: err.message, code: err.code || 'ERROR' },
          });
          onError?.(err);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setBusy(false);
        }
      }
    },
    [commit, patchMessage]
  );

  const send = useCallback(
    async (text, images = [], opts = {}) => {
      if (abortRef.current) return;
      const trimmed = text.trim();
      if (!trimmed && !images.length) return;
      let chatId = activeId && chatsRef.current.some((c) => c.id === activeId) ? activeId : null;
      const userMsg = { id: uid(), role: 'user', content: trimmed, images };
      if (!chatId) {
        chatId = uid();
        const chat = { id: chatId, title: titleFrom(trimmed || 'Image'), mode: opts.mode || 'friendly', createdAt: Date.now(), updatedAt: Date.now(), messages: [userMsg] };
        commit([chat, ...chatsRef.current]);
        setActiveId(chatId);
      } else {
        commit(
          chatsRef.current.map((c) =>
            c.id === chatId ? { ...c, mode: opts.mode || c.mode || 'friendly', updatedAt: Date.now(), messages: [...c.messages, userMsg] } : c
          )
        );
      }
      await run(chatId, opts);
    },
    [activeId, commit, run]
  );

  const regenerate = useCallback(
    async (opts = {}) => {
      if (abortRef.current || !activeId) return;
      const chat = chatsRef.current.find((c) => c.id === activeId);
      if (!chat) return;
      let msgs = chat.messages;
      while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs = msgs.slice(0, -1);
      if (!msgs.length) return;
      commit(chatsRef.current.map((c) => (c.id === activeId ? { ...c, messages: msgs } : c)));
      await run(activeId, opts);
    },
    [activeId, commit, run]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
  }, []);

  const selectChat = useCallback((id) => {
    abortRef.current?.abort();
    setActiveId(id);
  }, []);

  const deleteChat = useCallback(
    (id) => {
      if (id === activeId) {
        abortRef.current?.abort();
        setActiveId(null);
      }
      commit(chatsRef.current.filter((c) => c.id !== id));
    },
    [activeId, commit]
  );

  const renameChat = useCallback(
    (id, title) => {
      const t = title.trim();
      if (t) commit(chatsRef.current.map((c) => (c.id === id ? { ...c, title: t.slice(0, 80) } : c)));
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    commit([]);
  }, [commit]);

  const active = useMemo(() => chats.find((c) => c.id === activeId) || null, [chats, activeId]);
  const sorted = useMemo(() => [...chats].sort((a, b) => b.updatedAt - a.updatedAt), [chats]);

  return { chats: sorted, active, activeId, busy, send, regenerate, stop, newChat, selectChat, deleteChat, renameChat, clearAll };
}
