'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MetricsPeriod, MetricsResponse } from '@/types';

interface UseDashboardResult {
  metrics: MetricsResponse | null;
  loading: boolean;
  error: string | null;
  period: MetricsPeriod;
  setPeriod: (p: MetricsPeriod) => void;
  refresh: () => Promise<void>;
}

export function useDashboard(initialPeriod: MetricsPeriod = '24h'): UseDashboardResult {
  const [period, setPeriod] = useState<MetricsPeriod>(initialPeriod);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics?period=${period}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MetricsResponse;
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { metrics, loading, error, period, setPeriod, refresh };
}
