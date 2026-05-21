'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimePoint } from '@/types';

const VIOLET = '#0007cb';
const SAND = '#dedbd6';
const ICON = '#707070';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function LatencyChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={SAND} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          stroke={ICON}
          tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: ICON }}
          tickLine={false}
          axisLine={{ stroke: SAND }}
          minTickGap={32}
        />
        <YAxis
          stroke={ICON}
          tick={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: ICON }}
          tickLine={false}
          axisLine={{ stroke: SAND }}
          tickFormatter={(v) => `${v}ms`}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-canvas-white)',
            border: '1px solid var(--color-border-sand)',
            borderRadius: 4,
            fontFamily: 'IBM Plex Mono',
            fontSize: 11,
          }}
          labelFormatter={formatTime}
          formatter={(v: number) => [`${v}ms`, 'Avg latency']}
        />
        <Line
          type="monotone"
          dataKey="avgMs"
          stroke={VIOLET}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: VIOLET }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
