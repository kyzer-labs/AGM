export function Stat({
  title,
  value,
  footer,
}: {
  title: string;
  value: number;
  footer: string;
}) {
  return (
    <div className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {title}
      </div>
      <div className="mt-1 font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
        {value}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        {footer}
      </div>
    </div>
  );
}
