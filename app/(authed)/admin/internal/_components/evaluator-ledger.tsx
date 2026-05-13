"use client";

import type { useQuery } from "convex/react";
import { Users } from "lucide-react";

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
        <>
          <ul className="divide-y divide-[var(--ink-line)] md:hidden">
            {rows.map((row) => {
              const updated = row.submittedAt
                ? `Submitted ${formatMYT(row.submittedAt)}`
                : row.updatedAt
                  ? formatMYT(row.updatedAt)
                  : "Not yet";

              return (
                <li key={row.email} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs tabular-nums text-[var(--ink)]">
                        {row.email}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        {row.fullName ?? "Not signed in"}
                      </p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ClassLabel voterClass={row.voterClass} />
                    <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
                      {updated}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <AdminDataTable
            caption={`${title}. ${description}.`}
            maxHeight="calc(100dvh - 19rem)"
            tableClassName="min-w-[760px]"
            className="hidden rounded-none border-0 md:block"
          >
            <AdminDataTableHeader sticky>
              <AdminDataTableRow className="bg-[var(--paper-2)] text-left">
                <AdminDataTableHead>Evaluator</AdminDataTableHead>
                <AdminDataTableHead>Class</AdminDataTableHead>
                <AdminDataTableHead>Status</AdminDataTableHead>
                <AdminDataTableHead>Last update (MYT)</AdminDataTableHead>
              </AdminDataTableRow>
            </AdminDataTableHeader>
            <tbody>
              {rows.map((row) => (
                <AdminDataTableRow key={row.email}>
                  <AdminDataTableRowHead>
                    <div className="font-mono text-xs tabular-nums text-[var(--ink)]">
                      {row.email}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {row.fullName ?? "Not signed in"}
                    </div>
                  </AdminDataTableRowHead>
                  <AdminDataTableCell>
                    <ClassLabel voterClass={row.voterClass} />
                  </AdminDataTableCell>
                  <AdminDataTableCell>
                    <StatusBadge status={row.status} />
                  </AdminDataTableCell>
                  <AdminDataTableCell className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                    {row.submittedAt
                      ? `Submitted ${formatMYT(row.submittedAt)}`
                      : row.updatedAt
                        ? formatMYT(row.updatedAt)
                        : "Not yet"}
                  </AdminDataTableCell>
                </AdminDataTableRow>
              ))}
            </tbody>
          </AdminDataTable>
        </>
      )}
    </section>
  );
}
