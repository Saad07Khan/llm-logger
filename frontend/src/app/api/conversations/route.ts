import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { defaultModelFor } from '@/lib/llm/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const result = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    provider: c.provider,
    model: c.model,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c._count.messages,
    lastMessagePreview: c.messages[0]?.content ?? null,
  }));

  return Response.json(result);
}

export async function POST(req: NextRequest) {
  let body: { title?: string; provider?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const provider = body.provider ?? 'gemini';
  const model = body.model ?? defaultModelFor(provider);

  const conversation = await prisma.conversation.create({
    data: {
      title: body.title ?? null,
      provider,
      model,
    },
  });

  return Response.json(
    {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      provider: conversation.provider,
      model: conversation.model,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: 0,
      lastMessagePreview: null,
    },
    { status: 201 }
  );
}
