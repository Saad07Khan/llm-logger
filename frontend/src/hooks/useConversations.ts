'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ConversationStatus, ConversationSummary } from '@/types';

interface UseConversationsResult {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (opts?: { title?: string; provider?: string }) => Promise<ConversationSummary | null>;
  setStatus: (id: string, status: ConversationStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
}

export const CONVERSATIONS_CHANGED = 'conversations:changed';

function emitChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONVERSATIONS_CHANGED));
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ConversationSummary[];
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cross-component sync: any mutation anywhere dispatches `conversations:changed`.
  // Listeners (this hook, Sidebar) refetch immediately — no polling delay.
  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener(CONVERSATIONS_CHANGED, handler);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED, handler);
  }, [refresh]);

  const create = useCallback(
    async (opts?: { title?: string; provider?: string }) => {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts ?? {}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = (await res.json()) as ConversationSummary;
        setConversations((prev) => [created, ...prev]);
        emitChanged();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
        return null;
      }
    },
    []
  );

  const setStatus = useCallback(async (id: string, status: ConversationStatus) => {
    // Optimistic — flip the chip instantly so Pause/Resume feels immediate.
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    emitChanged();
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as ConversationSummary;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      emitChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      // Roll back by refetching authoritative state.
      void refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    // Optimistic local removal so the dashboard card vanishes instantly.
    const prevState = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    emitChanged();
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setConversations(prevState);
      emitChanged();
    }
  }, [conversations]);

  const rename = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as ConversationSummary;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      emitChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  }, []);

  return { conversations, loading, error, refresh, create, setStatus, remove, rename };
}
