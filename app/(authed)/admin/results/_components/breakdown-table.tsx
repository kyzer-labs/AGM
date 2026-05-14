import { Trophy } from "lucide-react";

import {
  AdminDataTable,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminDataTableRowHead,
} from "@/components/admin/data-table";
import { CandidatePhoto } from "@/components/candidate-photo";
import { cn } from "@/lib/utils";
import type { PreviewRow } from "./results-model";

export function BreakdownTable({
  row,
  internalShare,
  publicShare,
}: {
  row: PreviewRow;
  internalShare: number;
  publicShare: number;
}) {
  return (
    <AdminDataTable
      caption={
        <>
          Per-candidate breakdown for {row.positionName}. Internal share is{" "}
          {internalShare}%, public share is {publicShare}%.
        </>
      }
      tableClassName="min-w-[760px]"
      className="border-0"
    >
        <AdminDataTableHeader>
          <AdminDataTableRow className="text-left">
            <AdminDataTableHead className="px-2">
              Candidate
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right tabular-nums">
              TC ({row.weights.topCommittee}%)
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right tabular-nums">
              HE ({row.weights.headExecutive}%)
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right tabular-nums">
              Y2 ({row.weights.year2Committee}%)
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right tabular-nums">
              Public ({row.weights.public}%)
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right">
              Internal agg
            </AdminDataTableHead>
            <AdminDataTableHead className="px-2 text-right">
              Final
            </AdminDataTableHead>
          </AdminDataTableRow>
        </AdminDataTableHeader>
        <tbody>
          {row.breakdown.map((b) => {
            const isWinner = b.candidateId === row.winnerCandidateId;
            return (
              <AdminDataTableRow
                key={b.candidateId}
                className={cn(
                  isWinner ? "bg-[var(--color-success)]/10" : null,
                )}
              >
                <AdminDataTableRowHead className="px-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-10 w-7 shrink-0 place-items-center overflow-hidden rounded bg-[var(--paper)] ring-1 ring-[var(--ink-line)]">
                      <CandidatePhoto
                        src={b.photoUrl}
                        className="h-full w-full object-contain"
                        iconClassName="h-4 w-4"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[0.9375rem] font-medium leading-[1.2] text-[var(--ink)]">
                        <span className="truncate">{b.fullName}</span>
                        {isWinner ? (
                          <Trophy
                            className="h-3.5 w-3.5 shrink-0 text-[var(--teal)]"
                            aria-label="Winner"
                          />
                        ) : null}
                      </div>
                      {b.matric && !b.matric.startsWith("auto-") ? (
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                          {b.matric}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </AdminDataTableRowHead>
                <AdminDataTableCell className="px-2 text-right tabular-nums">
                  {(b.tcShare * 100).toFixed(1)}%
                </AdminDataTableCell>
                <AdminDataTableCell className="px-2 text-right tabular-nums">
                  {(b.heShare * 100).toFixed(1)}%
                </AdminDataTableCell>
                <AdminDataTableCell className="px-2 text-right tabular-nums">
                  {(b.y2Share * 100).toFixed(1)}%
                </AdminDataTableCell>
                <AdminDataTableCell className="px-2 text-right tabular-nums">
                  {b.publicVotes} ({(b.publicShare * 100).toFixed(1)}%)
                </AdminDataTableCell>
                <AdminDataTableCell className="px-2 text-right tabular-nums">
                  {(b.internalAggregate * 100).toFixed(2)}%
                </AdminDataTableCell>
                <AdminDataTableCell className="px-2 text-right font-semibold tabular-nums">
                  {(b.finalScore * 100).toFixed(2)}%
                </AdminDataTableCell>
              </AdminDataTableRow>
            );
          })}
        </tbody>
    </AdminDataTable>
  );
}
