import { Trophy } from "lucide-react";

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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Per-candidate breakdown for {row.positionName}. Internal share is{" "}
          {internalShare}%, public share is {publicShare}%.
        </caption>
        <thead>
          <tr className="border-b border-[var(--ink-line)] text-left">
            <th
              scope="col"
              className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
              Candidate
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              TC ({row.weights.topCommittee}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              HE ({row.weights.headExecutive}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              Y2 ({row.weights.year2Committee}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              Public ({row.weights.public}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
              Internal agg
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
              Final
            </th>
          </tr>
        </thead>
        <tbody>
          {row.breakdown.map((b) => {
            const isWinner = b.candidateId === row.winnerCandidateId;
            return (
              <tr
                key={b.candidateId}
                className={cn(
                  "border-b border-[var(--ink-line)] last:border-b-0",
                  isWinner ? "bg-[var(--color-success)]/10" : null,
                )}
              >
                <th
                  scope="row"
                  className="px-2 py-2 text-left font-normal align-top"
                >
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
                </th>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(b.tcShare * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(b.heShare * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(b.y2Share * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {b.publicVotes} ({(b.publicShare * 100).toFixed(1)}%)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(b.internalAggregate * 100).toFixed(2)}%
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  {(b.finalScore * 100).toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
