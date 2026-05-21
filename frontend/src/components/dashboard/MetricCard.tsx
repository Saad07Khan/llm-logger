import { Bracketed } from '@/components/layout/Bracketed';

interface Props {
  label: string;
  value: string;
  caption?: string;
  featured?: boolean;
}

export function MetricCard({ label, value, caption, featured }: Props) {
  return (
    <Bracketed corners={featured ? 4 : 2} className="surface-card flex flex-col gap-3 min-h-[140px]">
      <div className="mono">{label}</div>
      <div
        className="headline"
        style={{ fontSize: 54, letterSpacing: '-2.4px', lineHeight: 1 }}
      >
        {value}
      </div>
      {caption && <div className="mono-sm">{caption}</div>}
    </Bracketed>
  );
}
