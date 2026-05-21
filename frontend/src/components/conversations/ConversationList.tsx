'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import type { ConversationSummary } from '@/types';

interface Props {
  conversations: ConversationSummary[];
  activeId?: string | null;
}

export function ConversationList({ conversations, activeId }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = activeId ?? search.get('id');

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-2 text-[13px] text-muted">No conversations yet</div>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversations.map((c) => {
        const isActive = pathname.startsWith('/chat') && selected === c.id;
        return (
          <li key={c.id}>
            <Link
              href={`/chat?id=${c.id}`}
              className={cn(
                'block px-3 py-2 rounded-[4px] transition-colors',
                isActive ? 'bg-off-white' : 'hover:bg-off-white'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] truncate text-[color:var(--color-headline-black)]">
                  {c.title ?? 'Untitled'}
                </span>
                <span className="mono-sm shrink-0">{formatRelativeTime(c.updatedAt)}</span>
              </div>
              {c.lastMessagePreview && (
                <div className="mt-1 text-[12px] text-faint truncate">
                  {truncate(c.lastMessagePreview, 70)}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
