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
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function ConversationsPage() {
  const router = useRouter();
  const { conversations, loading, error, create, setStatus, remove } = useConversations();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return conversations;
    return conversations.filter((c) => c.status === filter);
  }, [conversations, filter]);

  const counts = useMemo(() => {
    return {
      ALL: conversations.length,
      ACTIVE: conversations.filter((c) => c.status === 'ACTIVE').length,
      CANCELLED: conversations.filter((c) => c.status === 'CANCELLED').length,
      COMPLETED: conversations.filter((c) => c.status === 'COMPLETED').length,
    };
  }, [conversations]);

  const handleNew = async () => {
    const created = await create();
    if (created) router.push(`/chat?id=${created.id}`);
  };

  return (
    <div className="flex-1">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-container mx-auto px-8 h-14 flex items-center justify-between">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Conversations
          </div>
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            New conversation
          </button>
        </div>
      </header>

      <div className="max-w-container mx-auto px-8 py-10">
        <h1 className="headline" style={{ fontSize: 54, letterSpacing: '-2.4px' }}>
          Conversations
        </h1>
        <p className="mt-3 text-[15px] text-muted max-w-[520px]">
          Every chat is logged with provider, model, latency, and token counts. Filter by status to
          triage active or cancelled sessions.
        </p>

        <div className="mt-8 flex items-center gap-1 border-b border-sand">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={cn('tab', filter === f.key && 'tab-active')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="mono-sm ml-2">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6">
            <span className="badge badge-error">Error · {error}</span>
          </div>
        )}

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
