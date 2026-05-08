"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  ChevronDown,
  Lock,
  Trophy,
  UserCircle2,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface PublicRow {
  positionId: Id<"positions">;
  positionName: string;
  tier: number;
  order: number;
  winnerCandidateId: Id<"candidates"> | null;
  winnerName: string | null;
  publishedAt: number | null;
  totalPublicVotes: number;
  breakdown: {
    candidateId: Id<"candidates">;
    fullName: string;
    matric: string;
    photoUrl: string | null;
    internalAvg: number;
    internalShare: number;
    publicVotes: number;
    publicShare: number;
    finalScore: number;
  }[];
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
  if (election === undefined)
    return (
      <main className="container-narrow py-12">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  if (election === null)
    return (
      <main className="container-narrow py-12">
        <EmptyState
          icon={<Award className="h-5 w-5" aria-hidden />}
          title="No active election"
          description="Results will appear here once the chairperson publishes them."
        />
      </main>
    );
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const data = useQuery(api.results.publicPublished, {
    electionId: election._id,
  });

  if (data === undefined) {
    return (
      <main className="container-narrow py-12">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (data === null || data.phase !== "published") {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" aria-hidden />
              Results not published yet
            </CardTitle>
            <CardDescription>
              <strong>{election.name}</strong> hasn&apos;t published results.
              When the chairperson releases them, the winners and full
              breakdown will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (data.rows.length === 0) {
    return (
      <main className="container-narrow py-12">
        <EmptyState
          icon={<Award className="h-5 w-5" aria-hidden />}
          title="Nothing to show"
          description="Results were published but no positions had a final winner."
        />
      </main>
    );
  }

  return (
    <main className="container-wide py-10 space-y-8">
      <header>
        <Badge tone="success" className="mb-2">
          <Trophy className="h-3 w-3" aria-hidden /> Final results
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          {election.name}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Combined 75% internal evaluation + 25% public vote, in ballot
          order. Click any position to see the full per-candidate breakdown.
        </p>
      </header>

      <div className="grid gap-3">
        {data.rows.map((row) => (
          <ResultBlock key={row.positionId} row={row} />
        ))}
      </div>
    </main>
  );
}

function ResultBlock({ row }: { row: PublicRow }) {
  const [open, setOpen] = useState(false);
  const winner =
    row.breakdown.find((b) => b.candidateId === row.winnerCandidateId) ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            Tier {row.tier}
          </div>
          <CardTitle className="flex-1 text-base">
            {row.positionName}
          </CardTitle>
        </div>
        {winner ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[var(--color-muted)]">
              {winner.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={winner.photoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle2
                  className="h-6 w-6 text-[var(--color-muted-foreground)]"
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Trophy
                  className="h-4 w-4 text-[var(--color-success)]"
                  aria-hidden
                />
                {winner.fullName}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {winner.matric} · final score{" "}
                {(winner.finalScore * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        ) : (
          <CardDescription>No winner recorded.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="px-0 text-xs"
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
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--color-muted-foreground)]">
                  <th className="px-2 py-1.5 font-medium">Candidate</th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Internal avg
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Internal share
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Public votes
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Public share
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Final
                  </th>
                </tr>
              </thead>
              <tbody>
                {row.breakdown.map((b) => (
                  <tr
                    key={b.candidateId}
                    className={
                      b.candidateId === row.winnerCandidateId
                        ? "bg-[var(--color-success)]/10"
                        : "border-b last:border-b-0"
                    }
                  >
                    <td className="px-2 py-2">
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
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.internalAvg.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {(b.internalShare * 100).toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.publicVotes}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {(b.publicShare * 100).toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {(b.finalScore * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {row.totalPublicVotes} total public votes
              {row.publishedAt
                ? ` · published ${new Date(row.publishedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
