'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInput } from '@/components/chat/ChatInput';
import { ProviderSelect } from '@/components/chat/ProviderSelect';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import type { ProviderId } from '@/lib/llm/factory';

export default function ChatPage() {
  return (
    <Suspense
      fallback={<div className="flex-1 flex items-center justify-center mono-sm">Loading…</div>}
    >
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id');

  const { create, refresh, setStatus } = useConversations();
  const {
    conversation,
    messages,
    isStreaming,
    streamingText,
    notFound,
    send,
    cancel,
    refresh: refreshChat,
  } = useChat(conversationId);

  const [provider, setProvider] = useState<ProviderId>('groq');

  useEffect(() => {
    if (conversation?.provider) {
      setProvider(conversation.provider as ProviderId);
    }
  }, [conversation?.provider]);

  // If the convo we're viewing got deleted elsewhere, bounce back to empty state.
  useEffect(() => {
    if (notFound && conversationId) {
      router.replace('/chat');
    }
  }, [notFound, conversationId, router]);

  const startNewConversation = async () => {
    const created = await create({ provider });
    if (created) router.replace(`/chat?id=${created.id}`);
  };

  const handleProviderChange = async (next: ProviderId) => {
    setProvider(next);
    if (!conversationId) return;
    await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: next }),
    });
    await refresh();
  };

  const handleSend = async (text: string) => {
    if (!conversationId) {
      const created = await create({ provider, title: text.slice(0, 60) });
      if (!created) return;
      router.replace(`/chat?id=${created.id}`);
      await send(text, created.id);
      return;
    }
    await send(text);
  };

  const handleResume = async () => {
    if (!conversationId) return;
    await setStatus(conversationId, 'ACTIVE');
    await Promise.all([refresh(), refreshChat()]);
  };

  const isPaused = conversation?.status === 'PAUSED';
  const isCancelled = conversation?.status === 'CANCELLED';
  const isReadOnly = isPaused || isCancelled;
  const showBreadcrumb = !!conversation;

  return (
    <div className="flex flex-col h-screen">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-container mx-auto pl-16 pr-3 md:px-8 min-h-14 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Chat
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <ProviderSelect
              value={provider}
              onChange={handleProviderChange}
              disabled={isStreaming}
            />
            <button type="button" className="btn btn-outline" onClick={startNewConversation}>
              New
            </button>
          </div>
        </div>
      </header>

      {showBreadcrumb && (
        <div className="max-w-container mx-auto w-full px-4 sm:px-8 pt-3 pb-1 flex items-center gap-3 flex-wrap">
          <div
            className="text-[15px] truncate min-w-0"
            style={{ color: 'var(--color-headline-black)' }}
          >
            {conversation?.title ?? 'Untitled'}
          </div>
          {conversation?.model && (
            <span className="badge badge-provider">{conversation.model}</span>
          )}
          {isPaused && <span className="badge badge-paused">Paused</span>}
          {isCancelled && <span className="badge badge-cancelled">Cancelled</span>}
        </div>
      )}

      {isPaused && (
        <div className="max-w-container mx-auto w-full px-4 sm:px-8 pt-3">
          <div
            className="surface-card flex flex-wrap items-center gap-3 p-4"
            style={{ background: 'var(--color-surface-cream)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="section-label" style={{ display: 'inline-flex' }}>
                Paused
              </div>
              <p className="mt-2 text-[14px] text-[color:var(--color-headline-black)]">
                This conversation is paused. Resume it to keep chatting.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleResume}>
              Resume
            </button>
            <Link href="/conversations" className="btn btn-ghost">
              All conversations
            </Link>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="max-w-container mx-auto w-full px-4 sm:px-8 pt-3">
          <div
            className="surface-card flex flex-wrap items-center gap-3 p-4"
            style={{ background: 'var(--color-surface-cream)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="section-label" style={{ display: 'inline-flex' }}>
                Cancelled
              </div>
              <p className="mt-2 text-[14px] text-[color:var(--color-headline-black)]">
                This conversation has been cancelled. It is read-only and cannot be reopened. Start
                a new conversation to keep chatting.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={startNewConversation}>
              New conversation
            </button>
            <Link href="/conversations" className="btn btn-ghost">
              All conversations
            </Link>
          </div>
        </div>
      )}

      <ChatWindow
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />

      <ChatInput
        onSend={handleSend}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={isReadOnly}
        placeholder={
          isCancelled
            ? 'This conversation has been cancelled and is read-only.'
            : isPaused
            ? 'Resume this conversation to send a message…'
            : undefined
        }
      />
    </div>
  );
}
