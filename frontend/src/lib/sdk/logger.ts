import type {
  ChatMessage,
  LLMOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
} from '@/lib/llm/types';
import type { InferenceLogPayload, RequestStatus } from '@/types';
import { redactAndPreview } from './pii';
import { enqueueInferenceLog } from './queue';

export interface LogContext {
  conversationId: string;
  metadata?: Record<string, unknown>;
}

function joinInput(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join('\n');
}

function summarize(provider: LLMProvider, status: RequestStatus, args: {
  conversationId: string;
  start: number;
  end: number;
  inputText: string;
  outputText: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown>;
}): InferenceLogPayload {
  return {
    conversationId: args.conversationId,
    provider: provider.name,
    model: provider.model,
    status,
    requestTimestamp: new Date(args.start).toISOString(),
    responseTimestamp: new Date(args.end).toISOString(),
    latencyMs: args.end - args.start,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    totalTokens: args.totalTokens,
    inputPreview: redactAndPreview(args.inputText),
    outputPreview: redactAndPreview(args.outputText),
    errorMessage: args.errorMessage,
    errorCode: args.errorCode,
    metadata: args.metadata,
  };
}

export async function loggedChat(
  provider: LLMProvider,
  messages: ChatMessage[],
  ctx: LogContext,
  options?: LLMOptions
): Promise<LLMResponse> {
  const start = Date.now();
  const inputText = joinInput(messages);
  try {
    const response = await provider.chat(messages, options);
    const end = Date.now();
    void enqueueInferenceLog(
      summarize(provider, 'SUCCESS', {
        conversationId: ctx.conversationId,
        start,
        end,
        inputText,
        outputText: response.content,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.totalTokens,
        errorMessage: null,
        errorCode: null,
        metadata: { streaming: false, ...(ctx.metadata ?? {}) },
      })
    );
    return response;
  } catch (err) {
    const end = Date.now();
    const aborted = err instanceof Error && err.name === 'AbortError';
    void enqueueInferenceLog(
      summarize(provider, aborted ? 'CANCELLED' : 'ERROR', {
        conversationId: ctx.conversationId,
        start,
        end,
        inputText,
        outputText: '',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: aborted ? 'ABORTED' : 'PROVIDER_ERROR',
        metadata: { streaming: false, ...(ctx.metadata ?? {}) },
      })
    );
    throw err;
  }
}

export async function* loggedChatStream(
  provider: LLMProvider,
  messages: ChatMessage[],
  ctx: LogContext,
  options?: LLMOptions
): AsyncGenerator<LLMStreamChunk, LLMResponse, void> {
  const start = Date.now();
  const inputText = joinInput(messages);
  let assembled = '';
  let final: LLMResponse | null = null;
  try {
    const iterator = provider.chatStream(messages, options);
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        final = next.value;
        break;
      }
      assembled += next.value.delta;
      yield next.value;
    }
    const end = Date.now();
    const result: LLMResponse = final ?? {
      content: assembled,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      model: provider.model,
      provider: provider.name,
    };
    void enqueueInferenceLog(
      summarize(provider, 'SUCCESS', {
        conversationId: ctx.conversationId,
        start,
        end,
        inputText,
        outputText: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        errorMessage: null,
        errorCode: null,
        metadata: { streaming: true, ...(ctx.metadata ?? {}) },
      })
    );
    return result;
  } catch (err) {
    const end = Date.now();
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      options?.signal?.aborted === true;
    void enqueueInferenceLog(
      summarize(provider, aborted ? 'CANCELLED' : 'ERROR', {
        conversationId: ctx.conversationId,
        start,
        end,
        inputText,
        outputText: assembled,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: aborted ? 'ABORTED' : 'PROVIDER_ERROR',
        metadata: { streaming: true, partial: assembled.length > 0, ...(ctx.metadata ?? {}) },
      })
    );
    throw err;
  }
}
