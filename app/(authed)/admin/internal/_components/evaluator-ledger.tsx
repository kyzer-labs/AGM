"use client";

import type { useQuery } from "convex/react";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { SectionMarker } from "@/components/ui/section-marker";
import type { api } from "@/convex/_generated/api";
import { formatMYT } from "@/lib/format";
import {
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./internal-model";
import { ClassLabel, StatusBadge } from "./internal-badges";
import { FilterChips } from "./filter-chips";

export function EvaluatorLedger({
  rows,
  activeTab,
  counts,
  total,
  onFilterChange,
  title,
  description,
}: {
  rows: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminCompletionList>>>;
  activeTab: VoterClass | "all";
  counts: Record<VoterClass, number>;
  total: number;
  onFilterChange: (cls: VoterClass | "all") => void;
  title: string;
  description: string;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-md border border-[var(--ink-line)] bg-[var(--paper)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ink-line)] bg-[var(--paper-2)] px-4 py-3">
        <SectionMarker primary={title} secondary={description} />
        <FilterChips
          current={activeTab}
          counts={counts}
          total={total}
          onChange={onFilterChange}
        />
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title={
            activeTab === "all"
              ? "Whitelist is empty"
              : `No evaluators in ${VOTER_CLASS_LABEL[activeTab]}`
          }
          description={
            activeTab === "all"
              ? "Add internal evaluators on the Whitelist page before opening evaluation."
              : "Change the class filter or add evaluators in this class from the Whitelist page."
          }
        />
      ) : (
        <div className="max-h-[calc(100dvh-19rem)] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Evaluator
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Class
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Status
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Last update (MYT)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.email}
                  className="border-b border-[var(--ink-line)] last:border-b-0"
                >
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs tabular-nums text-[var(--ink)]">
                      {row.email}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {row.fullName ?? "Not signed in"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ClassLabel voterClass={row.voterClass} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                    {row.submittedAt
                      ? `Submitted ${formatMYT(row.submittedAt)}`
                      : row.updatedAt
                        ? formatMYT(row.updatedAt)
                        : "Not yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
