import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  LLMOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
} from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function splitSystem(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else turns.push({ role: m.role, content: m.content });
  }
  return { system: systemParts.join('\n'), turns };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) throw new Error('AnthropicProvider: ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const { system, turns } = splitSystem(messages);

    const response = await this.client.messages.create(
      {
        model: this.model,
        system: system || undefined,
        messages: turns,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      },
      { signal: options.signal }
    );

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      model: this.model,
      provider: this.name,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<LLMStreamChunk, LLMResponse, void> {
    const { system, turns } = splitSystem(messages);

    const stream = await this.client.messages.stream(
      {
        model: this.model,
        system: system || undefined,
        messages: turns,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      },
      { signal: options.signal }
    );

    let full = '';
    for await (const event of stream) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const delta = event.delta.text;
        full += delta;
        yield { delta };
      }
    }

    const final = await stream.finalMessage();
    return {
      content: full,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      totalTokens: final.usage.input_tokens + final.usage.output_tokens,
      model: this.model,
      provider: this.name,
    };
  }
}
