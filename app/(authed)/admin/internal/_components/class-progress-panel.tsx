"use client";

import { SectionMarker } from "@/components/ui/section-marker";
import type { api } from "@/convex/_generated/api";
import type { useQuery } from "convex/react";
import {
  VOTER_CLASSES,
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./internal-model";
import { ClassLabel } from "./internal-badges";

export function ClassProgressPanel({
  aggregate,
  countsByClass,
  classWeightLookup,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  countsByClass: Record<VoterClass, number>;
  classWeightLookup: Map<VoterClass, number>;
}) {
  return (
    <section aria-label="Class submission progress" className="space-y-3">
      <SectionMarker primary="Class progress" secondary="Weighted evaluator groups" />
      <div className="grid gap-3">
        {VOTER_CLASSES.map((cls) => {
          const submitted =
            aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
              ?.submitted ?? 0;
          const total = countsByClass[cls];
          const weight = classWeightLookup.get(cls) ?? 0;
          const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
          return (
            <ClassStatCard
              key={cls}
              voterClass={cls}
              submitted={submitted}
              total={total}
              weight={weight}
              pct={pct}
            />
          );
        })}
      </div>
    </section>
  );
}

function ClassStatCard({
  voterClass,
  submitted,
  total,
  weight,
  pct,
}: {
  voterClass: VoterClass;
  submitted: number;
  total: number;
  weight: number;
  pct: number;
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4">
      <div className="flex items-center justify-between">
        <ClassLabel voterClass={voterClass} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {weight}% weight
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
          {submitted}
          <span className="text-base font-normal text-[var(--ink-muted)]">
            {" "}
            / {total}
          </span>
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {pct}%
        </div>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${VOTER_CLASS_LABEL[voterClass]} submission progress`}
      >
        <div
          className="h-full bg-[var(--copper)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
