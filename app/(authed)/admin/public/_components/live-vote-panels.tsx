import { AlertTriangle, Eye, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

export function CascadePreview({
  cascade,
}: {
  cascade: {
    eligible: { fullName: string }[];
    removed: { fullName: string }[];
  };
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] px-4 py-3">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Cascade preview
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--ink)]">
        <span className="text-[var(--ink-muted)]">On the ballot: </span>
        {cascade.eligible.length === 0 ? (
          <span className="italic text-[var(--ink-muted)]">none</span>
        ) : (
          cascade.eligible.map((c) => c.fullName).join(", ")
        )}
      </p>
      {cascade.removed.length > 0 ? (
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          <span className="text-[var(--ink-muted)]">Removed by cascade: </span>
          {cascade.removed.map((c) => c.fullName).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

export function LiveCounts({
  counts,
  total,
  highlightWinnerId,
}: {
  counts: { candidateId: string; fullName: string; count: number }[];
  total: number;
  highlightWinnerId: Id<"candidates"> | null;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
        Live count · {total} {total === 1 ? "vote" : "votes"}
      </p>
      <ul className="space-y-2">
        {counts.map((c) => {
          const pct = total > 0 ? (c.count / total) * 100 : 0;
          const isWinner =
            highlightWinnerId !== null &&
            (c.candidateId as Id<"candidates">) === highlightWinnerId;
          return (
            <li key={c.candidateId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "truncate",
                    isWinner
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--ink)]",
                  )}
                >
                  {isWinner ? (
                    <Trophy
                      className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-[var(--teal)]"
                      aria-label="Winner"
                    />
                  ) : null}
                  {c.fullName}
                </span>
                <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                  <span className="text-[var(--ink)]">{c.count}</span>
                  {total > 0 ? <span> · {pct.toFixed(0)}%</span> : null}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]"
                role="presentation"
              >
                <div
                  className="h-full bg-[var(--teal)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WinnerStrip({ name }: { name: string }) {
  return (
    <div
      className="flex items-center gap-2 border-t border-[var(--ink-line)] pt-3"
      role="status"
    >
      <Trophy className="h-4 w-4 text-[var(--teal)]" aria-label="Winner" />
      <p className="text-sm">
        <span className="text-[var(--ink-muted)]">Winner: </span>
        <strong className="font-semibold text-[var(--ink)]">{name}</strong>
      </p>
    </div>
  );
}

export function UnresolvedTieStrip({ onResolve }: { onResolve: () => void }) {
  return (
    <div
      className="flex flex-col gap-3 border-y border-[var(--copper)] bg-[var(--paper-2)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
      role="alert"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--copper)]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Manual tie resolution required
        </div>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--ink)]">
          The automatic tiebreak ladder reached a manual decision. Pick the
          winner and write a reason for the audit log before opening the next
          ballot.
        </p>
      </div>
      <Button onClick={onResolve} variant="destructive" size="sm">
        Resolve tie
      </Button>
    </div>
  );
}
