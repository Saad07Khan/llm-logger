'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingDot } from './StreamingDot';
import type { MessageDTO } from '@/types';

interface Props {
  messages: MessageDTO[];
  streamingText: string;
  isStreaming: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function ChatWindow({
  messages,
  streamingText,
  isStreaming,
  emptyTitle = 'Start the conversation',
  emptySubtitle = 'Ask anything. Inference is logged automatically.',
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return <div className="flex-1" aria-hidden="true" />;
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-[920px] mx-auto px-6 py-8">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            timestamp={m.createdAt}
          />
        ))}
        {isStreaming && streamingText && (
          <MessageBubble role="ASSISTANT" content={streamingText} streaming />
        )}
        {isStreaming && !streamingText && (
          <div className="px-1 py-2">
            <StreamingDot />
          </div>
        )}
      </div>
    </div>
  );
}
