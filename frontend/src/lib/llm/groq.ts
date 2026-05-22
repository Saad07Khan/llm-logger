import OpenAI from 'openai';
import type {
  ChatMessage,
  LLMOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
} from './types';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) throw new Error('GroqProvider: GROQ_API_KEY is not set');
    this.client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
    this.model = model;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      },
      { signal: options.signal }
    );

    const choice = completion.choices[0];
    const usage = completion.usage;

    return {
      content: choice?.message?.content ?? '',
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      model: this.model,
      provider: this.name,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<LLMStreamChunk, LLMResponse, void> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: options.signal }
    );

    let full = '';
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let totalTokens: number | null = null;

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        yield { delta };
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? null;
        outputTokens = chunk.usage.completion_tokens ?? null;
        totalTokens = chunk.usage.total_tokens ?? null;
      }
    }

    return {
      content: full,
      inputTokens,
      outputTokens,
      totalTokens,
      model: this.model,
      provider: this.name,
    };
  }
}
