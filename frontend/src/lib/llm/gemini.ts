import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ChatMessage,
  LLMOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
} from './types';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function toGeminiHistory(messages: ChatMessage[]) {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return { systemInstruction: sys || undefined, turns };
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly model: string;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) throw new Error('GeminiProvider: GOOGLE_GEMINI_API_KEY is not set');
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const { systemInstruction, turns } = toGeminiHistory(messages);
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    });

    const last = turns.pop();
    if (!last) throw new Error('GeminiProvider: empty messages');

    const chat = model.startChat({ history: turns });
    const result = await chat.sendMessage(last.parts);
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      inputTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      totalTokens: usage?.totalTokenCount ?? null,
      model: this.model,
      provider: this.name,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<LLMStreamChunk, LLMResponse, void> {
    const { systemInstruction, turns } = toGeminiHistory(messages);
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    });

    const last = turns.pop();
    if (!last) throw new Error('GeminiProvider: empty messages');

    const chat = model.startChat({ history: turns });
    const result = await chat.sendMessageStream(last.parts);

    let full = '';
    let usage: { input: number | null; output: number | null; total: number | null } = {
      input: null,
      output: null,
      total: null,
    };

    for await (const chunk of result.stream) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const delta = chunk.text();
      if (delta) {
        full += delta;
        yield { delta };
      }
    }

    const final = await result.response;
    const meta = final.usageMetadata;
    if (meta) {
      usage = {
        input: meta.promptTokenCount ?? null,
        output: meta.candidatesTokenCount ?? null,
        total: meta.totalTokenCount ?? null,
      };
    }

    return {
      content: full,
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.total,
      model: this.model,
      provider: this.name,
    };
  }
}
