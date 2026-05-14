import { CheckCircle2, Circle, PenLine, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export function MetricBand({
  completion,
  submitted,
  draft,
  notStarted,
}: {
  completion: number;
  submitted: number;
  draft: number;
  notStarted: number;
}) {
  const metrics = [
    { label: "Whitelist", value: completion, icon: Users },
    { label: "Submitted", value: submitted, icon: CheckCircle2 },
    { label: "Draft", value: draft, icon: PenLine },
    { label: "Not started", value: notStarted, icon: Circle },
  ];

  return (
    <section
      aria-label="Internal evaluation metrics"
      className="grid overflow-hidden rounded-md border border-[var(--ink-line)] bg-[var(--paper)] sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map(({ label, value, icon: Icon }, index) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            index > 0 ? "border-t border-[var(--ink-line)]" : "",
            index % 2 === 1 ? "sm:border-l" : "",
            index > 1 ? "sm:border-t" : "sm:border-t-0",
            index > 0 ? "xl:border-l xl:border-t-0" : "",
          )}
        >
          <div>
            <div className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              {label}
            </div>
            <div className="mt-1 font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
              {value}
            </div>
          </div>
          <Icon className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
        </div>
      ))}
    </section>
  );
}
