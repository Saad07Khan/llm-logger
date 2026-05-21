import { formatLatency, formatNumber } from '@/lib/utils';
import type { ProviderBreakdown } from '@/types';

interface Props {
  rows: Record<string, ProviderBreakdown>;
}

export function ProviderTable({ rows }: Props) {
  const entries = Object.entries(rows);

  return (
    <div className="surface-card !p-0 overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-sand">
            <th className="mono px-5 py-3">Provider</th>
            <th className="mono px-5 py-3">Requests</th>
            <th className="mono px-5 py-3">Avg latency</th>
            <th className="mono px-5 py-3">Errors</th>
            <th className="mono px-5 py-3">Error rate</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-muted text-[14px]">
                No requests in this period yet
              </td>
            </tr>
          ) : (
            entries.map(([name, p]) => {
              const rate = p.count === 0 ? 0 : (p.errors / p.count) * 100;
              return (
                <tr key={name} className="border-b border-sand last:border-b-0">
                  <td className="px-5 py-4">
                    <span className="badge badge-provider">{name}</span>
                  </td>
                  <td className="px-5 py-4 text-[14px]">{formatNumber(p.count)}</td>
                  <td className="px-5 py-4 text-[14px]">{formatLatency(p.avgLatency)}</td>
                  <td className="px-5 py-4 text-[14px]">{p.errors}</td>
                  <td className="px-5 py-4 text-[14px]">{rate.toFixed(2)}%</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
