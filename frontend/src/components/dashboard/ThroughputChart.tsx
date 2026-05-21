'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimePoint } from '@/types';

const ORANGE = '#ff5600';
const SAND = '#dedbd6';
const ICON = '#707070';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function ThroughputChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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
          allowDecimals={false}
          width={40}
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
          formatter={(v: number) => [v, 'Requests']}
        />
        <Bar dataKey="count" fill={ORANGE} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
