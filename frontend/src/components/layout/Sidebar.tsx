'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn, truncate, formatRelativeTime } from '@/lib/utils';
import type { ConversationSummary } from '@/types';

const NAV = [
  { href: '/chat', label: 'Chat' },
  { href: '/conversations', label: 'Conversations' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/conversations');
        if (!res.ok) return;
        const data = (await res.json()) as ConversationSummary[];
        if (!cancelled) setConversations(data.slice(0, 12));
      } catch {
        /* ignore */
      }
    };
    void load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-sand flex flex-col h-screen sticky top-0',
        collapsed ? 'w-[60px]' : 'w-[260px]'
      )}
      style={{ background: 'var(--color-canvas-white)' }}
    >
      <div className="px-4 pt-5 pb-4 flex items-center justify-between border-b border-sand">
        {!collapsed && (
          <Link href="/chat" className="flex items-baseline gap-2">
            <span
              className="font-serif text-[22px] leading-none"
              style={{ color: 'var(--color-headline-black)', letterSpacing: '-0.4px' }}
            >
              llm·logger
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="btn btn-ghost btn-icon"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className="px-3 py-3 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center h-9 px-3 rounded-[4px] text-[14px] transition-colors',
                active
                  ? 'bg-off-white text-[color:var(--color-headline-black)]'
                  : 'text-[color:var(--color-mid-gray)] hover:text-[color:var(--color-headline-black)] hover:bg-off-white'
              )}
            >
              {collapsed ? item.label[0] : item.label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <>
          <div className="px-4 pt-4 pb-2 section-label">Recent</div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
            {conversations.length === 0 && (
              <div className="px-3 py-2 text-[13px] text-muted">No conversations yet</div>
            )}
            {conversations.map((c) => {
              const href = `/chat?id=${c.id}`;
              const active = pathname.startsWith('/chat');
              return (
                <Link
                  key={c.id}
                  href={href}
                  className={cn(
                    'block px-3 py-2 rounded-[4px] hover:bg-off-white transition-colors',
                    active && 'hover:bg-[color:var(--color-surface-cream)]'
                  )}
                >
                  <div className="text-[13px] leading-snug text-[color:var(--color-headline-black)] truncate">
                    {c.title ?? 'Untitled'}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="mono-sm">{c.provider}</span>
                    <span className="mono-sm">·</span>
                    <span className="mono-sm">{formatRelativeTime(c.updatedAt)}</span>
                  </div>
                  {c.lastMessagePreview && (
                    <div className="mt-1 text-[12px] text-faint truncate">
                      {truncate(c.lastMessagePreview, 60)}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="px-4 py-3 border-t border-sand mono-sm">
        <span>v1.0</span>
      </div>
    </aside>
  );
}
