"use client";

import { cn } from "@/lib/utils";
import {
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./whitelist-model";

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
      aria-label="Filter whitelist by class"
      className="flex flex-wrap items-center gap-1.5"
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
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
              active
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--ink)_92%,var(--paper)_8%)]"
                : "border-[var(--ink-line)] text-[var(--ink-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--ink)]",
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
