'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimePoint } from '@/types';

const ERROR = '#c93636';
const SAND = '#dedbd6';
const ICON = '#707070';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function ErrorChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="errorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ERROR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ERROR} stopOpacity={0.05} />
          </linearGradient>
        </defs>
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
          formatter={(v: number) => [v, 'Errors']}
        />
        <Area
          type="monotone"
          dataKey="errors"
          stroke={ERROR}
          strokeWidth={2}
          fill="url(#errorFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
