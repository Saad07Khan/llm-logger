import type { LLMProvider } from './types';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

export type ProviderId = 'gemini' | 'openai' | 'anthropic';

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  defaultModel: string;
}

export const PROVIDERS: ProviderSpec[] = [
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
  { id: 'openai', label: 'OpenAI GPT', defaultModel: 'gpt-4.1-nano' },
  { id: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-sonnet-4-20250514' },
];

export function getProvider(id: string, model?: string): LLMProvider {
  switch (id) {
    case 'gemini':
      return new GeminiProvider(
        process.env.GOOGLE_GEMINI_API_KEY ?? '',
        model ?? 'gemini-2.0-flash'
      );
    case 'openai':
      return new OpenAIProvider(
        process.env.OPENAI_API_KEY ?? '',
        model ?? 'gpt-4.1-nano'
      );
    case 'anthropic':
      return new AnthropicProvider(
        process.env.ANTHROPIC_API_KEY ?? '',
        model ?? 'claude-sonnet-4-20250514'
      );
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

export function defaultModelFor(id: string): string {
  const spec = PROVIDERS.find((p) => p.id === id);
  return spec?.defaultModel ?? 'gemini-2.0-flash';
}
