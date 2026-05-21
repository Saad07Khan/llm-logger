import { z } from 'zod';

export const InferenceLogSchema = z.object({
  conversationId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(['SUCCESS', 'ERROR', 'TIMEOUT', 'CANCELLED']),
  requestTimestamp: z.string().datetime(),
  responseTimestamp: z.string().datetime(),
  latencyMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  inputPreview: z.string(),
  outputPreview: z.string(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export type ValidatedInferenceLog = z.infer<typeof InferenceLogSchema>;

export function validate(payload: unknown): ValidatedInferenceLog {
  return InferenceLogSchema.parse(payload);
}

export function tryValidate(payload: unknown):
  | { ok: true; value: ValidatedInferenceLog }
  | { ok: false; issues: z.ZodIssue[] } {
  const result = InferenceLogSchema.safeParse(payload);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: result.error.issues };
}
