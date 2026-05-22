'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationDetail, MessageDTO } from '@/types';

interface UseChatResult {
  conversation: ConversationDetail | null;
  messages: MessageDTO[];
  isStreaming: boolean;
  streamingText: string;
  error: string | null;
  notFound: boolean;
  send: (text: string, overrideConversationId?: string) => Promise<void>;
  cancel: () => void;
  refresh: () => Promise<void>;
}

async function fetchConversation(
  id: string
): Promise<ConversationDetail | 'not-found' | 'error'> {
  try {
    const res = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
    if (res.status === 404) return 'not-found';
    if (!res.ok) return 'error';
    return (await res.json()) as ConversationDetail;
  } catch {
    return 'error';
  }
}

export function useChat(conversationId: string | null): UseChatResult {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(conversationId);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const refresh = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id) {
      setConversation(null);
      setMessages([]);
      setNotFound(false);
      return;
    }
    const result = await fetchConversation(id);
    if (conversationIdRef.current !== id) return;
    if (result === 'not-found') {
      setConversation(null);
      setMessages([]);
      setNotFound(true);
      return;
    }
    if (result === 'error') {
      setError('Failed to load conversation');
      return;
    }
    setNotFound(false);
    setConversation(result);
    setMessages(result.messages);
  }, []);

  useEffect(() => {
    if (isStreamingRef.current) return;
    setError(null);
    setNotFound(false);
    void refresh();
  }, [conversationId, refresh]);

  // Cross-component sync: when /conversations mutates state (pause/resume/delete),
  // pick it up here so the chat view reflects the new status without a reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (isStreamingRef.current) return;
      void refresh();
    };
    window.addEventListener('conversations:changed', handler);
    return () => window.removeEventListener('conversations:changed', handler);
  }, [refresh]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string, overrideConversationId?: string) => {
      const targetId = overrideConversationId ?? conversationIdRef.current;
      if (!targetId || !text.trim() || isStreamingRef.current) return;

      setError(null);
      setIsStreaming(true);
      isStreamingRef.current = true;
      setStreamingText('');

      const optimistic: MessageDTO = {
        id: `temp-${Date.now()}`,
        conversationId: targetId,
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
          body: JSON.stringify({ conversationId: targetId, message: text }),
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
        isStreamingRef.current = false;
        setStreamingText('');
        abortRef.current = null;

        const result = await fetchConversation(targetId);
        if (conversationIdRef.current === targetId) {
          if (result === 'not-found') {
            setConversation(null);
            setMessages([]);
            setNotFound(true);
          } else if (result !== 'error') {
            setNotFound(false);
            setConversation(result);
            setMessages(result.messages);
          }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('conversations:changed'));
        }
      }
    },
    []
  );

  return {
    conversation,
    messages,
    isStreaming,
    streamingText,
    error,
    notFound,
    send,
    cancel,
    refresh,
  };
}
