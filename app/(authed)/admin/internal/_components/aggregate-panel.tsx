"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { VOTER_CLASSES, type VoterClass } from "./internal-model";
import { ClassLabel } from "./internal-badges";

export function AggregatePanel({
  aggregate,
  activeTab,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  activeTab: VoterClass | "all";
}) {
  return (
    <section
      aria-label="Aggregate scores by class"
      className="space-y-3 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionMarker primary="Aggregate scores" secondary="Submitted only" />
        <ClipboardCheck className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden />
      </div>
      {aggregate.candidates.length === 0 || aggregate.criteria.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
          title="No data yet"
          description="Add candidates and configure rubric criteria first. Once internal evaluators submit, this table fills in."
        />
      ) : (
        <ClassAggregateTable aggregate={aggregate} activeTab={activeTab} />
      )}
    </section>
  );
}

function ClassAggregateTable({
  aggregate,
  activeTab,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  activeTab: VoterClass | "all";
}) {
  const visibleClasses: VoterClass[] =
    activeTab === "all" ? VOTER_CLASSES : [activeTab];

  const grandTotalsByClass = useMemo(() => {
    const totals: Record<VoterClass, number> = {
      topCommittee: 0,
      headExecutive: 0,
      year2Committee: 0,
    };
    for (const c of aggregate.candidates) {
      for (const cls of c.byClass) {
        totals[cls.voterClass as VoterClass] += cls.totalSum;
      }
    }
    return totals;
  }, [aggregate]);

  return (
    <div className="space-y-8">
      {visibleClasses.map((cls) => {
        const grandTotal = grandTotalsByClass[cls];
        const weight =
          aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
            ?.weight ?? 0;
        const evaluators =
          aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
            ?.submitted ?? 0;
        const candidateRows = aggregate.candidates
          .map((c) => {
            const byCls = c.byClass.find((b) => b.voterClass === cls);
            const sum = byCls?.totalSum ?? 0;
            const share = grandTotal > 0 ? sum / grandTotal : 0;
            return {
              candidateId: c.candidateId,
              fullName: c.fullName,
              matric: c.matric,
              evaluatorCount: byCls?.evaluatorCount ?? 0,
              totalSum: sum,
              share,
              perCriterion: byCls?.perCriterion ?? [],
            };
          })
          .sort((a, b) => b.share - a.share);

        return (
          <div key={cls} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <ClassLabel voterClass={cls} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                weight{" "}
                <span className="tabular-nums">{weight}%</span>
                <span aria-hidden className="px-1 text-[var(--copper)]">
                  ·
                </span>
                <span className="tabular-nums">{evaluators}</span> submitted
                <span aria-hidden className="px-1 text-[var(--copper)]">
                  ·
                </span>
                <span className="tabular-nums">{grandTotal}</span> total points
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
                    <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Candidate
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Evaluators
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Sum
                    </th>
                    {aggregate.criteria.map((cr) => (
                      <th
                        key={cr._id}
                        className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)] whitespace-nowrap"
                      >
                        {cr.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidateRows.map((row) => (
                    <tr
                      key={row.candidateId}
                      className="border-b border-[var(--ink-line)] last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--ink)]">
                          {row.fullName}
                        </div>
                        {row.matric && !row.matric.startsWith("auto-") ? (
                          <div className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                            {row.matric}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.evaluatorCount}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.totalSum}
                      </td>
                      {aggregate.criteria.map((cr) => {
                        const cell = row.perCriterion.find(
                          (p) => p.criterionId === cr._id,
                        );
                        return (
                          <td
                            key={cr._id}
                            className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink-muted)]"
                          >
                            {cell && cell.count > 0
                              ? cell.average.toFixed(2)
                              : "-"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-[var(--ink)]">
                        {(row.share * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
