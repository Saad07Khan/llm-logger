import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { InferenceLogPayload } from '@/types';

export const INFERENCE_QUEUE_NAME = 'inference-log';

let connection: Redis | null = null;
let queue: Queue<InferenceLogPayload> | null = null;
let connectionFailed = false;

function getConnection(): Redis | null {
  if (connectionFailed) return null;
  if (connection) return connection;
  try {
    const url = process.env.REDIS_URL ?? 'redis://redis:6379';
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    connection.on('error', (err) => {
      console.error('[queue] redis error:', err.message);
    });
    return connection;
  } catch (err) {
    console.error('[queue] failed to create redis connection:', err);
    connectionFailed = true;
    return null;
  }
}

function getQueue(): Queue<InferenceLogPayload> | null {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue<InferenceLogPayload>(INFERENCE_QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
  return queue;
}

async function fallbackHttp(payload: InferenceLogPayload): Promise<void> {
  const url = (process.env.INGESTION_URL ?? 'http://ingestion:3001') + '/api/logs';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[queue] HTTP fallback failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[queue] HTTP fallback error:', err);
  }
}

export async function enqueueInferenceLog(payload: InferenceLogPayload): Promise<void> {
  const q = getQueue();
  if (!q) {
    await fallbackHttp(payload);
    return;
  }
  try {
    await q.add('inference-log', payload);
  } catch (err) {
    console.error('[queue] add() failed, falling back to HTTP:', err);
    await fallbackHttp(payload);
  }
}
