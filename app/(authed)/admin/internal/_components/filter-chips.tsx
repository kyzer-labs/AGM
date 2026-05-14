"use client";

import { cn } from "@/lib/utils";
import {
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./internal-model";

export function FilterChips({
  current,
  counts,
  total,
  onChange,
}: {
  current: VoterClass | "all";
  counts: Record<VoterClass, number>;
  total: number;
  onChange: (cls: VoterClass | "all") => void;
}) {
  const chips: { value: VoterClass | "all"; label: string; count: number }[] =
    [
      { value: "all", label: "All classes", count: total },
      {
        value: "topCommittee",
        label: VOTER_CLASS_LABEL.topCommittee,
        count: counts.topCommittee,
      },
      {
        value: "headExecutive",
        label: VOTER_CLASS_LABEL.headExecutive,
        count: counts.headExecutive,
      },
      {
        value: "year2Committee",
        label: VOTER_CLASS_LABEL.year2Committee,
        count: counts.year2Committee,
      },
    ];
  return (
    <div
      role="radiogroup"
      aria-label="Filter by class"
      className="inline-flex flex-wrap border border-[var(--ink-line)] bg-[var(--paper)]"
    >
      {chips.map((c) => {
        const active = current === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.value)}
            className={cn(
              "inline-flex items-center gap-2 border-r border-[var(--ink-line)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors duration-200 last:border-r-0 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
              active
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] text-[var(--ink-muted)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
            )}
          >
            <span>{c.label}</span>
            <span className="tabular-nums">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}
