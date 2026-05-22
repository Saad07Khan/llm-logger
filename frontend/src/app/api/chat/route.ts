import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/llm/factory';
import { loggedChatStream } from '@/lib/sdk/logger';
import type { ChatMessage } from '@/lib/llm/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatRequestBody {
  conversationId: string;
  message: string;
  provider?: string;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { conversationId, message } = body;
  if (!conversationId || !message?.trim()) {
    return Response.json(
      { error: 'conversationId and message are required' },
      { status: 400 }
    );
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }
  if (conversation.status === 'PAUSED') {
    return Response.json(
      { error: 'Conversation is paused' },
      { status: 409 }
    );
  }

  const providerId = body.provider ?? conversation.provider;
  let provider;
  try {
    provider = getProvider(providerId);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Provider init failed' },
      { status: 500 }
    );
  }

  await prisma.message.create({
    data: { conversationId, role: 'USER', content: message },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      provider: providerId,
      model: provider.model,
      title: conversation.title ?? message.slice(0, 60),
    },
  });

  const recent = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const ordered = recent.reverse();
  const llmMessages: ChatMessage[] = ordered.map((m) => ({
    role:
      m.role === 'ASSISTANT' ? 'assistant' : m.role === 'SYSTEM' ? 'system' : 'user',
    content: m.content,
  }));

  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = '';
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let totalTokens: number | null = null;

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      send('start', { conversationId, provider: provider.name, model: provider.model });

      try {
        const iter = loggedChatStream(
          provider,
          llmMessages,
          { conversationId, metadata: { source: 'web' } },
          { signal: abortController.signal }
        );
        while (true) {
          const next = await iter.next();
          if (next.done) {
            inputTokens = next.value.inputTokens;
            outputTokens = next.value.outputTokens;
            totalTokens = next.value.totalTokens;
            break;
          }
          assistantText += next.value.delta;
          send('delta', { text: next.value.delta });
        }

        await prisma.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: assistantText,
            tokenCount: outputTokens,
          },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        send('done', {
          conversationId,
          inputTokens,
          outputTokens,
          totalTokens,
        });
        controller.close();
      } catch (err) {
        const aborted =
          (err instanceof Error && err.name === 'AbortError') ||
          abortController.signal.aborted;
        if (assistantText.length > 0) {
          await prisma.message.create({
            data: {
              conversationId,
              role: 'ASSISTANT',
              content: assistantText + (aborted ? '\n\n[cancelled]' : ''),
              tokenCount: null,
            },
          });
        }
        send(aborted ? 'cancelled' : 'error', {
          message: err instanceof Error ? err.message : 'Stream failed',
        });
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
