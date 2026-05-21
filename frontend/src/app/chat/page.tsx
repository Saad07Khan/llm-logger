'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInput } from '@/components/chat/ChatInput';
import { ProviderSelect } from '@/components/chat/ProviderSelect';
import { useChat } from '@/hooks/useChat';
import { useConversations } from '@/hooks/useConversations';
import type { ProviderId } from '@/lib/llm/factory';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id');

  const { conversations, create, refresh } = useConversations();
  const { conversation, messages, isStreaming, streamingText, error, send, cancel } =
    useChat(conversationId);

  const [provider, setProvider] = useState<ProviderId>('gemini');

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
      setTimeout(() => void send(text), 50);
      return;
    }
    await send(text);
  };

  const title = conversation?.title ?? 'New conversation';

  return (
    <div className="flex flex-col h-screen">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-[920px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="section-label" style={{ display: 'inline-flex' }}>
              Chat
            </div>
            <div className="text-[15px] truncate" style={{ color: 'var(--color-headline-black)' }}>
              {title}
            </div>
            {conversation?.model && (
              <span className="badge badge-provider hidden sm:inline-flex">
                {conversation.model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ProviderSelect value={provider} onChange={handleProviderChange} disabled={isStreaming} />
            <button type="button" className="btn btn-outline" onClick={startNewConversation}>
              New
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-[920px] mx-auto px-6 pt-3 w-full">
          <div className="badge badge-error">Error · {error}</div>
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
