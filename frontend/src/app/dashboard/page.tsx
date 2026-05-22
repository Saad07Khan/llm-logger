'use client';

import { Bracketed } from '@/components/layout/Bracketed';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LatencyChart } from '@/components/dashboard/LatencyChart';
import { ThroughputChart } from '@/components/dashboard/ThroughputChart';
import { ErrorChart } from '@/components/dashboard/ErrorChart';
import { ProviderTable } from '@/components/dashboard/ProviderTable';
import { PeriodTabs } from '@/components/dashboard/PeriodTabs';
import { useDashboard } from '@/hooks/useDashboard';
import { formatLatency, formatNumber } from '@/lib/utils';

export default function DashboardPage() {
  const { metrics, loading, period, setPeriod } = useDashboard('24h');

  const total = metrics?.totalRequests ?? 0;
  const avg = metrics?.avgLatencyMs ?? 0;
  const p95 = metrics?.p95LatencyMs ?? 0;
  const errRate = (metrics?.errorRate ?? 0) * 100;
  const tokens = metrics?.totalTokens ?? 0;
  const rpm = metrics?.requestsPerMinute ?? 0;

  return (
    <div className="flex-1 min-w-0">
      <header className="nav-bar sticky top-0 z-10">
        <div className="max-w-container mx-auto pl-16 pr-4 sm:pl-4 sm:pr-6 md:px-8 h-14 flex items-center justify-between gap-3 flex-wrap">
          <div className="section-label" style={{ display: 'inline-flex' }}>
            Inference metrics
          </div>
          <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
            <PeriodTabs value={period} onChange={setPeriod} />
          </div>
        </div>
      </header>

      <div className="max-w-container mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1
              className="headline break-words"
              style={{ fontSize: 'clamp(40px, 6vw, 54px)', letterSpacing: '-2.4px' }}
            >
              Dashboard
            </h1>
            <p className="mt-3 text-[15px] text-muted max-w-[520px]">
              Latency, throughput, errors, and token consumption across every provider in the last{' '}
              <span className="mono-sm">{period}</span>.
            </p>
          </div>
          <div className="mono-sm">
            {loading ? 'Refreshing…' : `${formatNumber(total)} requests captured`}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total requests"
            value={formatNumber(total)}
            caption={`${rpm} per minute`}
            featured
          />
          <MetricCard
            label="Avg latency"
            value={formatLatency(avg)}
            caption={`p95 · ${formatLatency(p95)}`}
          />
          <MetricCard
            label="Error rate"
            value={`${errRate.toFixed(2)}%`}
            caption={`${Object.values(metrics?.byProvider ?? {}).reduce((a, p) => a + p.errors, 0)} errors`}
          />
          <MetricCard
            label="Total tokens"
            value={formatNumber(tokens)}
            caption="input + output"
          />
        </div>

        <div className="mt-10 grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-3">
          <Bracketed className="cream-card dot-grid min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="mono">Latency over time</div>
              <span className="mono-sm">avg ms</span>
            </div>
            <LatencyChart data={metrics?.latencyTimeSeries ?? []} />
          </Bracketed>

          <Bracketed className="cream-card dot-grid min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="mono">Throughput</div>
              <span className="mono-sm">requests</span>
            </div>
            <ThroughputChart data={metrics?.throughputTimeSeries ?? []} />
          </Bracketed>

          <Bracketed className="cream-card dot-grid min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="mono">Errors</div>
              <span className="mono-sm">count</span>
            </div>
            <ErrorChart data={metrics?.errorTimeSeries ?? []} />
          </Bracketed>
        </div>

        <div className="mt-10">
          <div className="mono mb-3">Provider breakdown</div>
          <div className="overflow-x-auto scrollbar-thin">
            <ProviderTable rows={metrics?.byProvider ?? {}} />
          </div>
        </div>
      </div>
    </div>
  );
}
