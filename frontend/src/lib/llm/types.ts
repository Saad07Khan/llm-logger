export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  model: string;
  provider: string;
}

export interface LLMStreamChunk {
  delta: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface LLMProvider {
  name: string;
  model: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
  chatStream(
    messages: ChatMessage[],
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamChunk, LLMResponse, void>;
}
