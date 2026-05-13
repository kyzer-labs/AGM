"use client";

import { useMemo } from "react";
import type { useQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";

import {
  AdminDataTable,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminDataTableRowHead,
} from "@/components/admin/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMarker } from "@/components/ui/section-marker";
import type { api } from "@/convex/_generated/api";
import {
  VOTER_CLASSES,
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./internal-model";
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
            <ol className="space-y-3 md:hidden">
              {candidateRows.map((row, index) => (
                <li
                  key={row.candidateId}
                  className="space-y-3 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
                        Rank {String(index + 1).padStart(2, "0")}
                      </p>
                      <h4 className="mt-1 text-sm font-medium leading-tight text-[var(--ink)]">
                        {row.fullName}
                      </h4>
                      {row.matric && !row.matric.startsWith("auto-") ? (
                        <p className="mt-1 font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                          {row.matric}
                        </p>
                      ) : null}
                    </div>
                    <p className="font-mono text-sm font-medium tabular-nums text-[var(--ink)]">
                      {(row.share * 100).toFixed(1)}%
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 border-t border-[var(--ink-line)] pt-3">
                    <div>
                      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                        Evaluators
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--ink)]">
                        {row.evaluatorCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                        Sum
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--ink)]">
                        {row.totalSum}
                      </dd>
                    </div>
                  </dl>

                  {aggregate.criteria.length > 0 ? (
                    <dl className="grid gap-2 border-t border-[var(--ink-line)] pt-3">
                      {aggregate.criteria.map((cr) => {
                        const cell = row.perCriterion.find(
                          (p) => p.criterionId === cr._id,
                        );
                        return (
                          <div
                            key={cr._id}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <dt className="text-xs text-[var(--ink-muted)]">
                              {cr.name}
                            </dt>
                            <dd className="font-mono text-xs tabular-nums text-[var(--ink)]">
                              {cell && cell.count > 0
                                ? cell.average.toFixed(2)
                                : "-"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  ) : null}
                </li>
              ))}
            </ol>

            <AdminDataTable
              caption={`${VOTER_CLASS_LABEL[cls]} aggregate scores, submitted evaluations only.`}
              tableClassName="min-w-[720px]"
              className="hidden md:block"
            >
              <AdminDataTableHeader>
                <AdminDataTableRow className="bg-[var(--paper-2)] text-left">
                    <AdminDataTableHead>Candidate</AdminDataTableHead>
                    <AdminDataTableHead className="text-right">
                      Evaluators
                    </AdminDataTableHead>
                    <AdminDataTableHead className="text-right">
                      Sum
                    </AdminDataTableHead>
                    {aggregate.criteria.map((cr) => (
                      <AdminDataTableHead
                        key={cr._id}
                        className="whitespace-nowrap text-right"
                      >
                        {cr.name}
                      </AdminDataTableHead>
                    ))}
                    <AdminDataTableHead className="text-right">
                      Share
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <tbody>
                  {candidateRows.map((row) => (
                    <AdminDataTableRow key={row.candidateId}>
                      <AdminDataTableRowHead>
                        <div className="font-medium text-[var(--ink)]">
                          {row.fullName}
                        </div>
                        {row.matric && !row.matric.startsWith("auto-") ? (
                          <div className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                            {row.matric}
                          </div>
                        ) : null}
                      </AdminDataTableRowHead>
                      <AdminDataTableCell className="text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.evaluatorCount}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.totalSum}
                      </AdminDataTableCell>
                      {aggregate.criteria.map((cr) => {
                        const cell = row.perCriterion.find(
                          (p) => p.criterionId === cr._id,
                        );
                        return (
                          <AdminDataTableCell
                            key={cr._id}
                            className="text-right font-mono tabular-nums text-[var(--ink-muted)]"
                          >
                            {cell && cell.count > 0
                              ? cell.average.toFixed(2)
                              : "-"}
                          </AdminDataTableCell>
                        );
                      })}
                      <AdminDataTableCell className="text-right font-mono font-medium tabular-nums text-[var(--ink)]">
                        {(row.share * 100).toFixed(1)}%
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </tbody>
            </AdminDataTable>
          </div>
        );
      })}
    </div>
  );
}
