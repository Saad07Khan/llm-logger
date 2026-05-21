export function StreamingDot({ label = 'Fin is typing' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 fade-in-up">
      <span className="pulse-dot" />
      <span className="mono-sm">{label}</span>
    </div>
  );
}
