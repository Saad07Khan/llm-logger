'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { ConversationCard } from '@/components/conversations/ConversationCard';
import type { ConversationStatus } from '@/types';

const FILTERS: Array<{ key: 'ALL' | ConversationStatus; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PAUSED', label: 'Paused' },
];

export default function ConversationsPage() {
  const router = useRouter();
  const { conversations, loading, create, setStatus, remove } = useConversations();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return conversations;
    return conversations.filter((c) => c.status === filter);
  }, [conversations, filter]);

  const counts = useMemo(() => {
    return {
      ALL: conversations.length,
      ACTIVE: conversations.filter((c) => c.status === 'ACTIVE').length,
      PAUSED: conversations.filter((c) => c.status === 'PAUSED').length,
    };
  }, [conversations]);

  const handleNew = async () => {
    const created = await create();
    if (created) router.push(`/chat?id=${created.id}`);
  };

  return (
    <div className="flex-1">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-container mx-auto pl-16 pr-3 md:px-8 min-h-14 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Conversations
          </div>
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            <span className="sm:hidden">+ New</span>
            <span className="hidden sm:inline">New conversation</span>
          </button>
        </div>
      </header>

      <div className="max-w-container mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <h1
          className="headline break-words"
          style={{ fontSize: 'clamp(40px, 6vw, 54px)', letterSpacing: '-2.4px' }}
        >
          Conversations
        </h1>
        <p className="mt-3 text-[15px] text-muted max-w-[520px]">
          Every chat is logged with provider, model, latency, and token counts. Filter by status to
          triage active or paused sessions.
        </p>

        <div className="mt-8 flex items-center gap-1 border-b border-sand overflow-x-auto scrollbar-thin">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={cn('tab shrink-0', filter === f.key && 'tab-active')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="mono-sm ml-2">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {loading && conversations.length === 0 ? (
          <div className="mt-10 mono-sm">Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 surface-card text-center">
            <div className="section-label justify-center" style={{ display: 'inline-flex' }}>
              Empty
            </div>
            <p className="mt-3 text-[15px] text-muted">
              No conversations match this filter. Start a new chat to begin logging.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 grid-cols-1 lg:grid-cols-2">
            {filtered.map((c, idx) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                onSetStatus={setStatus}
                onDelete={remove}
                featured={idx === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
