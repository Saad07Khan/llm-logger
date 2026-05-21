import type { ValidatedInferenceLog } from './validator';

export interface EnrichedInferenceLog extends ValidatedInferenceLog {
  tokensPerSecond: number | null;
  slow: boolean;
}

const SLOW_THRESHOLD_MS = 5000;

export function enrich(log: ValidatedInferenceLog): EnrichedInferenceLog {
  const outputTokens = log.outputTokens ?? 0;
  const seconds = log.latencyMs > 0 ? log.latencyMs / 1000 : 0;
  const tokensPerSecond =
    outputTokens > 0 && seconds > 0 ? +(outputTokens / seconds).toFixed(2) : null;

  return {
    ...log,
    tokensPerSecond,
    slow: log.latencyMs > SLOW_THRESHOLD_MS,
  };
}
