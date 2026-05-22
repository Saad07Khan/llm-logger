import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conversation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json({
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    provider: conversation.provider,
    model: conversation.model,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      tokenCount: m.tokenCount,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  let body: {
    status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
    title?: string;
    provider?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  // CANCELLED is terminal. The only edit allowed once cancelled is DELETE.
  if (existing.status === 'CANCELLED') {
    return Response.json(
      { error: 'Conversation is cancelled and cannot be modified' },
      { status: 409 }
    );
  }

  const updated = await prisma.conversation.update({
    where: { id: params.id },
    data: {
      status: body.status ?? existing.status,
      title: body.title ?? existing.title,
      provider: body.provider ?? existing.provider,
    },
  });

  return Response.json({
    id: updated.id,
    title: updated.title,
    status: updated.status,
    provider: updated.provider,
    model: updated.model,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await prisma.conversation.delete({ where: { id: params.id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 404 }
    );
  }
}
