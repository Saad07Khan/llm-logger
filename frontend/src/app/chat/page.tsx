'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInput } from '@/components/chat/ChatInput';
import { ProviderSelect } from '@/components/chat/ProviderSelect';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import type { ProviderId } from '@/lib/llm/factory';

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center mono-sm">Loading…</div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id');

  const { conversations, create, refresh } = useConversations();
  const { conversation, messages, isStreaming, streamingText, send, cancel } =
    useChat(conversationId);

  const [provider, setProvider] = useState<ProviderId>('groq');

  useEffect(() => {
    if (conversation?.provider) {
      setProvider(conversation.provider as ProviderId);
    }
  }, [conversation?.provider]);

  useEffect(() => {
    if (!conversationId && conversations.length > 0) {
      router.replace(`/chat?id=${conversations[0].id}`);
    }
  }, [conversationId, conversations, router]);

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

  const title = conversation?.title ?? 'New conversation';
  const showHeadline = messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-screen">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-container mx-auto pl-16 pr-3 md:px-8 min-h-14 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Chat
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <ProviderSelect value={provider} onChange={handleProviderChange} disabled={isStreaming} />
            <button type="button" className="btn btn-outline" onClick={startNewConversation}>
              New
            </button>
          </div>
        </div>
      </header>

      {showHeadline && (
        <div className="max-w-container mx-auto w-full px-4 sm:px-8 pt-8 pb-4">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Session
          </div>
          <h1
            className="headline mt-3 break-words"
            style={{ fontSize: 'clamp(34px, 6vw, 54px)', letterSpacing: '-2.4px' }}
          >
            {title}
          </h1>
          {conversation?.model && (
            <div className="mt-3">
              <span className="badge badge-provider">{conversation.model}</span>
            </div>
          )}
        </div>
      )}

      {!showHeadline && (
        <div className="max-w-container mx-auto w-full px-4 sm:px-8 pt-3 pb-1 flex items-center gap-3 flex-wrap">
          <div className="text-[15px] truncate min-w-0" style={{ color: 'var(--color-headline-black)' }}>
            {title}
          </div>
          {conversation?.model && (
            <span className="badge badge-provider">{conversation.model}</span>
          )}
        </div>
      )}

      <ChatWindow
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />

      <ChatInput onSend={handleSend} onCancel={cancel} isStreaming={isStreaming} />
    </div>
  );
}
