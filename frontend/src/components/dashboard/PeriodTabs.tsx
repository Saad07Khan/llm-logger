'use client';

import { cn } from '@/lib/utils';
import type { MetricsPeriod } from '@/types';

const PERIODS: { key: MetricsPeriod; label: string }[] = [
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

interface Props {
  value: MetricsPeriod;
  onChange: (p: MetricsPeriod) => void;
}

export function PeriodTabs({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-sand">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={cn('tab', value === p.key && 'tab-active')}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
