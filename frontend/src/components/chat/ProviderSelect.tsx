'use client';

import { PROVIDERS, type ProviderId } from '@/lib/llm/factory';

interface Props {
  value: string;
  onChange: (value: ProviderId) => void;
  disabled?: boolean;
}

export function ProviderSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="mono-sm">Provider</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ProviderId)}
        className="input-bordered h-9 py-0 text-[13px] cursor-pointer disabled:opacity-60"
        style={{ minWidth: 160 }}
      >
        {PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
