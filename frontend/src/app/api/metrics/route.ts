import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bucketSizeFor, periodToMs } from '@/lib/utils';
import type { MetricsPeriod, MetricsResponse, ProviderBreakdown } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return Math.round(sorted[base] + rest * (sorted[base + 1] - sorted[base]));
  }
  return sorted[base];
}

function bucketKey(ts: Date, sizeMs: number): string {
  const t = ts.getTime();
  const rounded = Math.floor(t / sizeMs) * sizeMs;
  return new Date(rounded).toISOString();
}

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get('period') ?? '24h') as MetricsPeriod;
  const windowMs = periodToMs(period);
  const bucketMs = bucketSizeFor(period);
  const since = new Date(Date.now() - windowMs);

  const logs = await prisma.inferenceLog.findMany({
    where: { requestTimestamp: { gte: since } },
    orderBy: { requestTimestamp: 'asc' },
    select: {
      provider: true,
      status: true,
      latencyMs: true,
      totalTokens: true,
      requestTimestamp: true,
    },
  });

  const totalRequests = logs.length;
  const latencies = logs
    .map((l) => l.latencyMs ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const avgLatencyMs =
    latencies.length === 0
      ? 0
      : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p95LatencyMs = quantile(latencies, 0.95);

  const errorCount = logs.filter((l) => l.status === 'ERROR' || l.status === 'TIMEOUT').length;
  const errorRate = totalRequests === 0 ? 0 : errorCount / totalRequests;
  const totalTokens = logs.reduce((acc, l) => acc + (l.totalTokens ?? 0), 0);
  const requestsPerMinute =
    totalRequests === 0 ? 0 : +(totalRequests / (windowMs / 60000)).toFixed(2);

  const byProvider: Record<string, ProviderBreakdown> = {};
  for (const l of logs) {
    const p = (byProvider[l.provider] ??= { count: 0, avgLatency: 0, errors: 0 });
    p.count += 1;
    p.avgLatency += l.latencyMs ?? 0;
    if (l.status === 'ERROR' || l.status === 'TIMEOUT') p.errors += 1;
  }
  for (const p of Object.values(byProvider)) {
    p.avgLatency = p.count === 0 ? 0 : Math.round(p.avgLatency / p.count);
  }

  const latencyMap = new Map<string, { sum: number; count: number }>();
  const throughputMap = new Map<string, number>();
  const errorMap = new Map<string, number>();
  for (const l of logs) {
    const key = bucketKey(l.requestTimestamp, bucketMs);
    const lat = latencyMap.get(key) ?? { sum: 0, count: 0 };
    lat.sum += l.latencyMs ?? 0;
    lat.count += 1;
    latencyMap.set(key, lat);
    throughputMap.set(key, (throughputMap.get(key) ?? 0) + 1);
    if (l.status === 'ERROR' || l.status === 'TIMEOUT') {
      errorMap.set(key, (errorMap.get(key) ?? 0) + 1);
    }
  }

  const startBucket = Math.floor(since.getTime() / bucketMs) * bucketMs;
  const endBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
  const buckets: string[] = [];
  for (let t = startBucket; t <= endBucket; t += bucketMs) {
    buckets.push(new Date(t).toISOString());
  }

  const latencyTimeSeries = buckets.map((timestamp) => {
    const entry = latencyMap.get(timestamp);
    return {
      timestamp,
      avgMs: entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : 0,
    };
  });
  const throughputTimeSeries = buckets.map((timestamp) => ({
    timestamp,
    count: throughputMap.get(timestamp) ?? 0,
  }));
  const errorTimeSeries = buckets.map((timestamp) => ({
    timestamp,
    errors: errorMap.get(timestamp) ?? 0,
  }));

  const response: MetricsResponse = {
    totalRequests,
    avgLatencyMs,
    p95LatencyMs,
    errorRate: +errorRate.toFixed(4),
    totalTokens,
    requestsPerMinute,
    byProvider,
    latencyTimeSeries,
    throughputTimeSeries,
    errorTimeSeries,
  };

  return Response.json(response);
}
