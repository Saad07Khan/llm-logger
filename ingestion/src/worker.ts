import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { tryValidate } from './validator';
import { enrich } from './processor';
import { persistInferenceLog } from './storage';

const QUEUE_NAME = 'inference-log';

export function startWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on('error', (err) => {
    console.error('[worker] redis error:', err.message);
  });

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const result = tryValidate(job.data);
      if (!result.ok) {
        const summary = result.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Validation failed: ${summary}`);
      }
      const enriched = enrich(result.value);
      const id = await persistInferenceLog(enriched);
      return { id };
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[worker] job ${job.id} -> log ${result.id} (${job.data?.provider})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[worker] error:', err.message);
  });

  console.log(`[worker] listening on queue "${QUEUE_NAME}"`);
  return worker;
}
