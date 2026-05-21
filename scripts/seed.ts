import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
const MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-sonnet-4-20250514',
};

const SAMPLE_PROMPTS = [
  {
    title: 'Pricing strategy for the new tier',
    turns: [
      { user: 'Should we price the Pro tier at $29 or $39?', assistant: "It depends on willingness-to-pay in your segment. $29 keeps it accessible and pairs well with annual discounts; $39 signals premium positioning. If your Pro features include serious workflow value (multi-seat, analytics, SSO), $39 is defensible." },
      { user: 'We have analytics and 5 seats included.', assistant: 'Then $39 monthly with $390 annual is reasonable. Five seats puts the per-seat price under $8, which compares well against Notion and Linear. Frame the page around team value, not just feature count.' },
      { user: 'Any risk of churn at $39?', assistant: 'Churn risk increases when perceived value drops below price. Mitigate it with a strong onboarding email sequence in week 1, in-product nudges to the analytics dashboard, and a 30-day money-back guarantee.' },
    ],
  },
  {
    title: 'Refactor the auth middleware',
    turns: [
      { user: 'I want to extract the JWT verify logic out of express middleware.', assistant: 'Move the verification into a pure function that takes a token and returns the decoded payload or throws. The middleware then becomes a thin wrapper: read header, call verify, attach user to req. That makes the function unit-testable without express stubs.' },
      { user: 'Should I memoize the JWKS lookup?', assistant: 'Yes. JWKS endpoints are stable for the key rotation window. Cache the keys in-memory for 10 minutes minimum; jose and jwks-rsa both expose a built-in cache. Cold-starts otherwise add 80-200ms per first request.' },
    ],
  },
  {
    title: 'Investigating a Postgres slow query',
    turns: [
      { user: 'EXPLAIN ANALYZE shows a Seq Scan on inference_logs.', assistant: 'Seq Scan on a large table usually means the planner found the index unselective or missing. Check: does an index exist on the WHERE column? Are statistics fresh? Run ANALYZE inference_logs and re-check. If selectivity is low, partial indexes help.' },
      { user: 'I filter by provider and requestTimestamp.', assistant: 'Create a composite index: CREATE INDEX ON inference_logs (provider, requestTimestamp DESC). This serves both equality on provider and range on timestamp. Drop redundant single-column indexes if write throughput matters.' },
    ],
  },
];

function randomLatency(): number {
  const base = Math.random() < 0.85 ? 600 + Math.random() * 1400 : 3500 + Math.random() * 4500;
  return Math.round(base);
}

function randomTokens(): { input: number; output: number } {
  const input = 40 + Math.floor(Math.random() * 400);
  const output = 80 + Math.floor(Math.random() * 600);
  return { input, output };
}

async function main() {
  console.log('[seed] starting');

  for (let i = 0; i < SAMPLE_PROMPTS.length; i++) {
    const sample = SAMPLE_PROMPTS[i];
    const provider = PROVIDERS[i % PROVIDERS.length];
    const model = MODELS[provider];

    const conversation = await prisma.conversation.create({
      data: {
        title: sample.title,
        provider,
        model,
        status: i === SAMPLE_PROMPTS.length - 1 ? 'COMPLETED' : 'ACTIVE',
      },
    });

    let cursor = Date.now() - (SAMPLE_PROMPTS.length - i) * 3 * 60 * 60 * 1000;

    for (const turn of sample.turns) {
      cursor += 30_000 + Math.random() * 60_000;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          content: turn.user,
          createdAt: new Date(cursor),
        },
      });
      const latency = randomLatency();
      const { input, output } = randomTokens();
      cursor += latency + 500;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: turn.assistant,
          tokenCount: output,
          createdAt: new Date(cursor),
        },
      });
      await prisma.inferenceLog.create({
        data: {
          conversationId: conversation.id,
          provider,
          model,
          status: 'SUCCESS',
          requestTimestamp: new Date(cursor - latency),
          responseTimestamp: new Date(cursor),
          latencyMs: latency,
          inputTokens: input,
          outputTokens: output,
          totalTokens: input + output,
          inputPreview: turn.user.slice(0, 200),
          outputPreview: turn.assistant.slice(0, 200),
          errorMessage: null,
          errorCode: null,
          metadata: { streaming: true, tokensPerSecond: +(output / (latency / 1000)).toFixed(2) },
        },
      });
    }
  }

  console.log('[seed] adding scattered inference logs for dashboard charts');
  const allConvos = await prisma.conversation.findMany();
  if (allConvos.length === 0) throw new Error('No conversations to attach logs to');

  for (let i = 0; i < 60; i++) {
    const convo = allConvos[i % allConvos.length];
    const ts = Date.now() - Math.random() * 24 * 60 * 60 * 1000;
    const latency = randomLatency();
    const { input, output } = randomTokens();
    const isError = Math.random() < 0.04;
    await prisma.inferenceLog.create({
      data: {
        conversationId: convo.id,
        provider: convo.provider,
        model: convo.model,
        status: isError ? 'ERROR' : 'SUCCESS',
        requestTimestamp: new Date(ts),
        responseTimestamp: new Date(ts + latency),
        latencyMs: latency,
        inputTokens: isError ? null : input,
        outputTokens: isError ? null : output,
        totalTokens: isError ? null : input + output,
        inputPreview: 'sample input',
        outputPreview: isError ? '' : 'sample output',
        errorMessage: isError ? 'rate_limit_exceeded' : null,
        errorCode: isError ? 'RATE_LIMIT' : null,
        metadata: { synthetic: true },
      },
    });
  }

  console.log('[seed] done');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
