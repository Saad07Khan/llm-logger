import { cn, formatRelativeTime } from '@/lib/utils';
import type { Role } from '@/types';

interface Props {
  role: Role;
  content: string;
  timestamp?: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, timestamp, streaming }: Props) {
  const isUser = role === 'USER';
  const isSystem = role === 'SYSTEM';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="mono-sm" style={{ color: 'var(--color-icon-gray)' }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full mb-4', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex flex-col gap-1 max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words border',
            isUser
              ? 'text-[color:var(--color-canvas-white)] border-transparent'
              : 'border-sand'
          )}
          style={{
            borderRadius: '18px',
            background: isUser ? 'rgba(20,18,18,0.92)' : 'var(--color-canvas-white)',
            color: isUser ? 'var(--color-canvas-white)' : 'var(--color-body-text-black)',
            letterSpacing: '-0.16px',
          }}
        >
          {content}
          {streaming && (
            <span
              className="inline-block w-[2px] h-[15px] ml-[2px] align-middle"
              style={{
                background: isUser ? 'var(--color-canvas-white)' : 'var(--color-headline-black)',
                animation: 'pulseDot 0.9s ease-in-out infinite',
              }}
            />
          )}
        </div>
        {timestamp && <span className="mono-sm">{formatRelativeTime(timestamp)}</span>}
      </div>
    </div>
  );
}
