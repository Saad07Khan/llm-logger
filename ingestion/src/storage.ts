import { PrismaClient } from '@prisma/client';
import type { EnrichedInferenceLog } from './processor';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export async function persistInferenceLog(log: EnrichedInferenceLog): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: log.conversationId },
    select: { id: true },
  });
  if (!conversation) {
    throw new Error(`Unknown conversationId: ${log.conversationId}`);
  }

  const created = await prisma.inferenceLog.create({
    data: {
      conversationId: log.conversationId,
      provider: log.provider,
      model: log.model,
      status: log.status,
      requestTimestamp: new Date(log.requestTimestamp),
      responseTimestamp: new Date(log.responseTimestamp),
      latencyMs: log.latencyMs,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      totalTokens: log.totalTokens,
      inputPreview: log.inputPreview,
      outputPreview: log.outputPreview,
      errorMessage: log.errorMessage,
      errorCode: log.errorCode,
      metadata: {
        ...log.metadata,
        tokensPerSecond: log.tokensPerSecond,
        slow: log.slow,
      },
    },
    select: { id: true },
  });
  return created.id;
}
