"use client";

import { useId, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown, Trophy, UserCircle2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
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

  return (
    <main className="container-wide space-y-12 py-12 sm:py-16">
      <header className="space-y-4">
        <SectionMarker primary="Final results" secondary="Published" />
        <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-[var(--ink)] sm:text-5xl">
          {election.name}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Combined internal aggregate ({internalShare}%) and public vote (
          {publicShare}%), in ballot order. Each position lists its winner;
          open a position for the full per-candidate breakdown.
        </p>
      </header>

      <ol className="space-y-10">
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
    <article className="space-y-5 border-t border-[var(--ink-line)] pt-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker primary={`Tier ${row.tier}`} />
        <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl">
          {row.positionName}
        </h2>
      </div>

      {winner ? (
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-muted)]">
            {winner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winner.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle2
                className="h-7 w-7 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-semibold text-[var(--ink)] sm:text-lg">
              <Trophy
                className="h-4 w-4 text-[var(--color-success)]"
                aria-label="Winner"
              />
              {winner.fullName}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums">
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
                        {b.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.photoUrl}
                            alt=""
                            className="h-6 w-6 rounded object-cover"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded bg-[var(--color-muted)]" />
                        )}
                        <span>{b.fullName}</span>
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

