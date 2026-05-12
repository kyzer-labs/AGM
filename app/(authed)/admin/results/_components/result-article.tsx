"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCcw,
  Trophy,
} from "lucide-react";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { formatMYT } from "@/lib/format";
import { internalSharePercent } from "@/lib/weights";
import type { PreviewRow } from "./results-model";
import { TIE_STEP_LABELS } from "./results-model";
import { BreakdownTable } from "./breakdown-table";

export function ResultArticle({
  row,
  index,
  isSuper,
  busy,
  onRecompute,
}: {
  row: PreviewRow;
  index: number;
  isSuper: boolean;
  busy: boolean;
  onRecompute: () => void;
}) {
  const computedAndQuiet = row.state !== null && !row.hasUnresolvedTie;
  const [open, setOpen] = useState(!computedAndQuiet);

  const stateBadge = (() => {
    if (row.hasUnresolvedTie) {
      return (
        <Badge tone="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Tie unresolved
        </Badge>
      );
    }
    if (row.state === "published") {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Published
        </Badge>
      );
    }
    if (row.state === "manualTieResolved") {
      return (
        <Badge tone="brand">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Manually resolved
        </Badge>
      );
    }
    if (row.state === "previewed") {
      return (
        <Badge tone="brand">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Computed
        </Badge>
      );
    }
    return <Badge tone="muted">Not computed yet</Badge>;
  })();

  const tieBreakLabel =
    row.tieBreakStep && row.tieBreakStep !== "finalScore"
      ? (TIE_STEP_LABELS[row.tieBreakStep] ?? row.tieBreakStep)
      : null;

  const winner =
    row.breakdown.find((b) => b.candidateId === row.winnerCandidateId) ??
    null;

  const internalShare = internalSharePercent(row.weights);
  const publicShare = Math.max(0, 100 - internalShare);

  if (!open) {
    return (
      <article className="border-t border-[var(--ink-line)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={`Open ${row.positionName} breakdown`}
          className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-4 text-left transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--paper-2)]/40 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
        >
          <span
            className="font-mono text-lg font-medium tabular-nums text-[var(--ink-muted)] sm:text-xl"
            aria-hidden
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <SectionMarker primary={`Tier ${row.tier}`} />
          <h2 className="font-display text-base font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-lg">
            {row.positionName}
          </h2>
          {winner ? (
            <span className="flex items-center gap-2 text-sm">
              <Trophy
                className="h-3.5 w-3.5 text-[var(--teal)]"
                aria-hidden
              />
              <span className="font-medium text-[var(--ink)]">
                {winner.fullName}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] tabular-nums text-[var(--ink-muted)]">
                {(winner.finalScore * 100).toFixed(2)}%
              </span>
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-3">
            {stateBadge}
            <span
              className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]"
              aria-hidden
            >
              Open
              <ChevronDown className="h-3 w-3" aria-hidden />
            </span>
          </span>
        </button>
      </article>
    );
  }

  return (
    <article className="space-y-5 border-t border-[var(--ink-line)] pt-6 pb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span
          className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker
          primary={`Tier ${row.tier}`}
          secondary={`Ballot order ${row.order + 1}`}
        />
        <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl">
          {row.positionName}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {stateBadge}
          {computedAndQuiet ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              aria-label={`Collapse ${row.positionName}`}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em]"
            >
              Collapse
              <ChevronDown
                className="h-3 w-3 rotate-180"
                aria-hidden
              />
            </Button>
          ) : null}
        </div>
      </div>

      {winner ? (
        <div className="flex items-start gap-4">
          <div className="grid h-20 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--paper)] ring-1 ring-[var(--ink-line)]">
            <CandidatePhoto
              src={winner.photoUrl}
              className="h-full w-full object-contain"
              iconClassName="h-6 w-6"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[1.0625rem] font-semibold leading-[1.18] text-[var(--ink)] sm:text-[1.1875rem]">
              <Trophy
                className="h-4 w-4 text-[var(--teal)]"
                aria-label="Winner"
              />
              {winner.fullName}
            </p>
            <p className="mt-1 font-mono text-[0.6875rem] uppercase leading-[1.25] tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
              {winner.matric && !winner.matric.startsWith("auto-")
                ? `${winner.matric} · `
                : ""}
              Final score {(winner.finalScore * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No winner recorded for this position yet.
        </p>
      )}

      {tieBreakLabel || row.manualResolutionReason ? (
        <div className="space-y-1">
          {tieBreakLabel ? (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--copper)] tabular-nums">
              Tie broken by: {tieBreakLabel}
            </p>
          ) : null}
          {row.manualResolutionReason ? (
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Manual decision:{" "}
              </span>
              {row.manualResolutionReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {row.breakdown.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No breakdown yet. This position has not been closed.
        </p>
      ) : (
        <BreakdownTable
          row={row}
          internalShare={internalShare}
          publicShare={publicShare}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ink-line)] pt-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
          {row.totalPublicVotes} total public{" "}
          {row.totalPublicVotes === 1 ? "vote" : "votes"}
          {row.publishedAt ? (
            <>
              {" · "}Published {formatMYT(row.publishedAt)}
            </>
          ) : null}
        </p>
        {isSuper && row.state ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecompute}
            disabled={busy}
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden /> Recompute
          </Button>
        ) : null}
      </div>
    </article>
  );
}
