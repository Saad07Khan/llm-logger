'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationDetail, MessageDTO } from '@/types';

interface UseChatResult {
  conversation: ConversationDetail | null;
  messages: MessageDTO[];
  isStreaming: boolean;
  streamingText: string;
  error: string | null;
  send: (text: string) => Promise<void>;
  cancel: () => void;
  refresh: () => Promise<void>;
}

export function useChat(conversationId: string | null): UseChatResult {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ConversationDetail;
      setConversation(data);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim() || isStreaming) return;
      setError(null);
      setIsStreaming(true);
      setStreamingText('');

      const optimistic: MessageDTO = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: 'USER',
        content: text,
        tokenCount: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: text }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const block of events) {
            const lines = block.split('\n');
            let eventName = 'message';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventName = line.slice(7).trim();
              else if (line.startsWith('data: ')) dataStr += line.slice(6);
            }
            if (!dataStr) continue;
            let data: { text?: string; message?: string } = {};
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }
            if (eventName === 'delta' && data.text) {
              assistantText += data.text;
              setStreamingText(assistantText);
            } else if (eventName === 'error') {
              setError(data.message ?? 'Stream error');
            } else if (eventName === 'cancelled') {
              break;
            } else if (eventName === 'done') {
              /* final */
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          /* user cancelled */
        } else {
          setError(err instanceof Error ? err.message : 'Send failed');
        }
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        abortRef.current = null;
        await refresh();
      }
    },
    [conversationId, isStreaming, refresh]
  );

  return {
    conversation,
    messages,
    isStreaming,
    streamingText,
    error,
    send,
    cancel,
    refresh,
  };
}
