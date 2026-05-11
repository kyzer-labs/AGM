"use client";

import { useId, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown, Trophy } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { CandidatePhoto } from "@/components/candidate-photo";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Standby as StandbyBlock } from "@/components/ui/standby";
import { cn } from "@/lib/utils";
import { formatMYT } from "@/lib/format";
import { internalSharePercent } from "@/lib/weights";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface PublicBreakdown {
  candidateId: Id<"candidates">;
  fullName: string;
  matric: string;
  photoUrl: string | null;
  publicVotes: number;
  internalAggregate: number;
  publicAggregate: number;
  finalScore: number;
}

interface PublicRow {
  positionId: Id<"positions">;
  positionName: string;
  tier: number;
  order: number;
  winnerCandidateId: Id<"candidates"> | null;
  winnerName: string | null;
  publishedAt: number | null;
  totalPublicVotes: number;
  weights: {
    topCommittee: number;
    headExecutive: number;
    year2Committee: number;
    public: number;
  };
  breakdown: PublicBreakdown[];
}

export default function PublicResultsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <PageSkeleton />;
  if (election === null) {
    return (
      <Standby
        cycleName={null}
        phase="No active cycle"
        body="Final results appear here once the chairperson publishes them. The page activates the moment a cycle is created."
      />
    );
  }
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const data = useQuery(api.results.publicPublished, {
    electionId: election._id,
  });

  if (data === undefined) return <PageSkeleton />;

  if (data === null || data.phase !== "published") {
    return (
      <Standby
        cycleName={election.name}
        phase="Results not published yet"
        body={`${election.name} has not published results. When the chairperson releases them, the winners and full per-candidate breakdown appear here.`}
      />
    );
  }

  if (data.rows.length === 0) {
    return (
      <Standby
        cycleName={election.name}
        phase="No positions to show"
        body="Results were published, but no positions had a final winner. If this looks wrong, contact the AGM admin team."
      />
    );
  }

  const headerWeights = data.rows[0]?.weights ?? {
    topCommittee: 0,
    headExecutive: 0,
    year2Committee: 0,
    public: 0,
  };
  const internalShare = internalSharePercent(headerWeights);
  const publicShare = Math.max(0, 100 - internalShare);

  const firstPublishedAt = data.rows.find((r) => r.publishedAt !== null)
    ?.publishedAt ?? null;

  return (
    <main className="container-wide space-y-14 py-14 sm:space-y-20 sm:py-20">
      <header className="space-y-6 sm:space-y-8">
        <SectionMarker
          primary={`AGM ${election.year}`}
          secondary={
            firstPublishedAt ? (
              <>
                Final results
                <span aria-hidden className="px-1.5 text-[var(--copper)]">
                  ·
                </span>
                Published{" "}
                <time dateTime={new Date(firstPublishedAt).toISOString()}>
                  {formatMYT(firstPublishedAt)}
                </time>
              </>
            ) : (
              "Final results"
            )
          }
        />
        <div className="space-y-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
            Annual General Meeting
          </p>
          <h1 className="font-serif text-[clamp(2.75rem,7vw,5rem)] font-medium leading-[0.96] tracking-[-0.014em] text-[var(--ink)]">
            {election.name}
          </h1>
        </div>
        <p className="max-w-[62ch] text-sm leading-relaxed text-[var(--color-muted-foreground)] sm:text-base">
          The combined internal evaluation ({internalShare}%) and public AGM
          ballot ({publicShare}%) determine each position. Results are
          listed in ballot order; open a position to read the full
          per-candidate breakdown.
        </p>
      </header>

      <ol className="space-y-12 sm:space-y-14">
        {data.rows.map((row, index) => (
          <li key={row.positionId}>
            <ResultBlock row={row} index={index} />
          </li>
        ))}
      </ol>
    </main>
  );
}

function ResultBlock({ row, index }: { row: PublicRow; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const winner =
    row.breakdown.find((b) => b.candidateId === row.winnerCandidateId) ?? null;

  const internalShare = internalSharePercent(row.weights);
  const publicShare = Math.max(0, 100 - internalShare);

  return (
    <article className="space-y-6 border-t border-[var(--ink-line)] pt-7 sm:pt-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span
          className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)] sm:text-[1.625rem]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker primary={`Tier ${row.tier}`} />
        <h2 className="font-serif text-2xl font-medium leading-[1.1] tracking-[-0.012em] text-[var(--ink)] sm:text-[1.875rem]">
          {row.positionName}
        </h2>
      </div>

      {winner ? (
        <div className="flex items-center gap-5">
          <div className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--paper)] ring-1 ring-[var(--ink-line)]">
            <CandidatePhoto
              src={winner.photoUrl}
              className="h-full w-full object-contain"
              iconClassName="h-7 w-7"
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2.5 font-serif text-[1.375rem] font-semibold leading-[1.12] text-[var(--ink)] sm:text-[1.625rem]">
              <Trophy
                className="h-5 w-5 shrink-0 text-[var(--color-success)]"
                aria-label="Winner"
              />
              <span className="truncate">{winner.fullName}</span>
            </p>
            <p className="mt-2 font-mono text-[0.6875rem] uppercase leading-[1.25] tracking-[0.18em] text-[var(--ink-muted)] tabular-nums">
              {winner.matric && !winner.matric.startsWith("auto-")
                ? `${winner.matric} · `
                : ""}
              Final score {(winner.finalScore * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No winner recorded for this position.
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="px-0 font-mono text-[11px] uppercase tracking-[0.22em]"
      >
        {open ? "Hide" : "Show"} full breakdown
        <ChevronDown
          className={cn(
            "ml-1 h-3 w-3 transition-transform",
            open ? "rotate-180" : undefined,
          )}
          aria-hidden
        />
      </Button>

      {open ? (
        <div id={panelId} className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Per-candidate breakdown for {row.positionName}
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-[var(--color-muted-foreground)]">
                <th scope="col" className="px-2 py-1.5 font-medium">
                  Candidate
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Internal aggregate ({internalShare}%)
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Public ({publicShare}%)
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Public votes
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
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
                      "border-b last:border-b-0",
                      isWinner ? "bg-[var(--color-success)]/10" : null,
                    )}
                  >
                    <th
                      scope="row"
                      className="px-2 py-2 text-left font-normal"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-7 shrink-0 place-items-center overflow-hidden rounded bg-[var(--paper)] ring-1 ring-[var(--ink-line)]">
                          <CandidatePhoto
                            src={b.photoUrl}
                            className="h-full w-full object-contain"
                            iconClassName="h-4 w-4"
                          />
                        </span>
                        <span className="text-[0.9375rem] font-medium leading-[1.2] text-[var(--ink)]">
                          {b.fullName}
                        </span>
                        {isWinner ? (
                          <Trophy
                            className="h-3.5 w-3.5 text-[var(--color-success)]"
                            aria-label="Winner"
                          />
                        ) : null}
                      </div>
                    </th>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {(b.internalAggregate * 100).toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {(b.publicAggregate * 100).toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.publicVotes}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {(b.finalScore * 100).toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
            {row.totalPublicVotes} total public votes
            {row.publishedAt ? (
              <>
                {" "}
                <span aria-hidden>·</span> Published{" "}
                {formatMYT(row.publishedAt)}
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12 sm:py-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-8 pt-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </main>
  );
}

function Standby({
  cycleName,
  phase,
  body,
}: {
  cycleName: string | null;
  phase: string;
  body: string;
}) {
  return (
    <StandbyBlock
      markerPrimary="Final results"
      markerSecondary={phase}
      cycleName={cycleName}
      body={body}
    />
  );
}
