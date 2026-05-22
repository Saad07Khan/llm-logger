'use client';

import Link from 'next/link';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import { Bracketed } from '@/components/layout/Bracketed';
import type { ConversationStatus, ConversationSummary } from '@/types';

interface Props {
  conversation: ConversationSummary;
  onSetStatus: (id: string, status: ConversationStatus) => void;
  onDelete: (id: string) => void;
  featured?: boolean;
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  if (status === 'ACTIVE')
    return <span className="badge badge-active">Active</span>;
  return <span className="badge badge-paused">Paused</span>;
}

export function ConversationCard({ conversation, onSetStatus, onDelete, featured }: Props) {
  const inner = (
    <div className="flex flex-col h-full p-5 sm:p-6 gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Link
          href={`/chat?id=${conversation.id}`}
          className="text-[18px] leading-snug headline hover:text-[color:var(--color-accent-violet)] transition-colors flex-1 min-w-0 break-words"
          style={{ fontSize: 20, letterSpacing: '-0.6px' }}
        >
          {conversation.title ?? 'Untitled conversation'}
        </Link>
        <StatusBadge status={conversation.status} />
      </div>

      <p className="text-[14px] text-muted line-clamp-2 min-h-[2.5em]">
        {conversation.lastMessagePreview
          ? truncate(conversation.lastMessagePreview, 140)
          : 'No messages yet'}
      </p>

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <span className="badge badge-provider">{conversation.provider}</span>
        <span className="mono-sm">{conversation.messageCount ?? 0} msg</span>
        <span className="mono-sm">·</span>
        <span className="mono-sm">{formatRelativeTime(conversation.updatedAt)}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-sand">
        <Link href={`/chat?id=${conversation.id}`} className="btn btn-outline">
          Open
        </Link>
        {conversation.status === 'ACTIVE' ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onSetStatus(conversation.id, 'PAUSED')}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onSetStatus(conversation.id, 'ACTIVE')}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost ml-auto"
          onClick={() => onDelete(conversation.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <Bracketed
      corners={featured ? 4 : 2}
      className={cn(
        'surface-card !p-0 transition-colors',
        'hover:border-[color:var(--color-headline-black)]'
      )}
    >
      {inner}
    </Bracketed>
  );
}
