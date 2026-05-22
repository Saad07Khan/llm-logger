export type ProviderName = 'gemini' | 'openai' | 'anthropic';

export type ConversationStatus = 'ACTIVE' | 'PAUSED';
export type Role = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type RequestStatus = 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';

export interface ConversationSummary {
  id: string;
  title: string | null;
  status: ConversationStatus;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  tokenCount: number | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageDTO[];
}

export interface InferenceLogPayload {
  conversationId: string;
  provider: string;
  model: string;
  status: RequestStatus;
  requestTimestamp: string;
  responseTimestamp: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  inputPreview: string;
  outputPreview: string;
  errorMessage: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown>;
}

export type MetricsPeriod = '1h' | '6h' | '24h' | '7d';

export interface ProviderBreakdown {
  count: number;
  avgLatency: number;
  errors: number;
}

export interface TimePoint {
  timestamp: string;
  avgMs?: number;
  count?: number;
  errors?: number;
}

export interface MetricsResponse {
  totalRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  totalTokens: number;
  requestsPerMinute: number;
  byProvider: Record<string, ProviderBreakdown>;
  latencyTimeSeries: TimePoint[];
  throughputTimeSeries: TimePoint[];
  errorTimeSeries: TimePoint[];
}
