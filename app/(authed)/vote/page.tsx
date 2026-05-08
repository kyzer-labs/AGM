"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Lock,
  ShieldOff,
  UserCircle2,
  Vote,
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
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";


export default function VotePage() {
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
          icon={<Vote className="h-5 w-5" aria-hidden />}
          title="No active election"
          description="The AGM hasn't started yet. This page will activate when public voting opens."
        />
      </main>
    );
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const internalStatus = useQuery(api.internal.myStatus, {
    electionId: election._id,
  });

  if (internalStatus === undefined) {
    return (
      <main className="container-narrow py-12">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (internalStatus.isWhitelisted) {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5" aria-hidden />
              Internal evaluators do not vote here
            </CardTitle>
            <CardDescription>
              You are listed as a Year 2 internal evaluator for{" "}
              <strong>{election.name}</strong>. Your input flows through the
              internal rubric (75% weight). Public voting is reserved for
              external members.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (
    election.phase === "setup" ||
    election.phase === "internalOpen" ||
    election.phase === "internalClosed"
  ) {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden />
              Voting hasn&apos;t started yet
            </CardTitle>
            <CardDescription>
              The public AGM voting begins when the chairperson opens the
              first ballot. Stay on this page — it will update live the
              moment voting starts.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (
    election.phase === "resultsPreview" ||
    election.phase === "published"
  ) {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" aria-hidden />
              Voting has ended
            </CardTitle>
            <CardDescription>
              All ballots are closed. Head to{" "}
              <a className="underline" href="/results">
                Results
              </a>{" "}
              once the chairperson publishes them.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return <Live election={election} />;
}

function Live({ election }: { election: Doc<"elections"> }) {
  const active = useQuery(api.sessions.getActiveSession, {
    electionId: election._id,
  });

  if (active === undefined) {
    return (
      <main className="container-narrow py-12">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (active === null) {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-pulse" aria-hidden />
              Waiting for the next ballot
            </CardTitle>
            <CardDescription>
              The chairperson will open the next position momentarily. Keep
              this tab open — the ballot appears here automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return <Ballot session={active} />;
}

interface ActiveSession {
  positionId: Id<"positions">;
  name: string;
  tier: number;
  sessionStartedAt: number | null;
  candidates: {
    candidateId: Id<"candidates">;
    fullName: string;
    matric: string | null;
    bio: string | null;
    photoUrl: string | null;
    fallbackOrder: number;
  }[];
}

function Ballot({ session }: { session: ActiveSession }) {
  const myVote = useQuery(api.votes.myVote, { positionId: session.positionId });
  const cast = useMutation(api.votes.cast);

  const [selected, setSelected] = useState<Id<"candidates"> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected(null);
    setConfirming(false);
  }, [session.positionId]);

  if (myVote === undefined) {
    return (
      <main className="container-narrow py-12">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (myVote) {
    const chosen = session.candidates.find(
      (c) => c.candidateId === myVote.candidateId,
    );
    return (
      <main className="container-narrow py-12 space-y-6">
        <header>
          <Badge tone="brand" className="mb-2">
            Live ballot · {session.name}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vote recorded
          </h1>
        </header>
        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <CheckCircle2
              className="mt-1 h-6 w-6 shrink-0 text-[var(--color-success)]"
              aria-hidden
            />
            <div>
              <p className="text-sm">
                Your vote for <strong>{chosen?.fullName ?? "your choice"}</strong>{" "}
                has been recorded for <strong>{session.name}</strong>. You
                cannot change this vote, and you will not be able to vote
                for this position again.
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                Stay on this page — the next ballot will appear here
                automatically when the chairperson opens it.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const onSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await cast({ positionId: session.positionId, candidateId: selected });
      toast.success("Vote recorded");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Could not vote.");
      toast.error("Vote failed", { description: m });
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const chosen = session.candidates.find((c) => c.candidateId === selected);

  return (
    <main className="container-wide py-10 space-y-6">
      <header>
        <Badge tone="brand" className="mb-2">
          Live ballot
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vote for {session.name}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Pick exactly one candidate. You cannot change your vote after
          submitting.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {session.candidates.map((c) => {
          const isSelected = selected === c.candidateId;
          return (
            <button
              key={c.candidateId}
              type="button"
              onClick={() => setSelected(c.candidateId)}
              className={cn(
                "flex h-full flex-col items-start rounded-lg border bg-[var(--color-card)] p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                isSelected
                  ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                  : "hover:border-[var(--color-foreground)]/30",
              )}
            >
              <div className="flex w-full items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--color-muted)]">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photoUrl}
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
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.fullName}</div>
                  {c.matric && !c.matric.startsWith("auto-") ? (
                    <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {c.matric}
                    </div>
                  ) : null}
                </div>
                {isSelected ? (
                  <CheckCircle2
                    className="h-5 w-5 text-[var(--color-primary)]"
                    aria-hidden
                  />
                ) : null}
              </div>
              {c.bio ? (
                <p className="mt-3 line-clamp-3 text-xs text-[var(--color-muted-foreground)]">
                  {c.bio}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-[var(--color-card)]/95 px-4 py-3 shadow-lg backdrop-blur">
        {chosen ? (
          <span className="text-sm">
            Selected:{" "}
            <strong>{chosen.fullName}</strong>
            {chosen.matric && !chosen.matric.startsWith("auto-") ? (
              <>
                {" "}
                <span className="text-[var(--color-muted-foreground)]">
                  ({chosen.matric})
                </span>
              </>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            Pick a candidate above to continue
          </span>
        )}
        <div className="flex-1" />
        {confirming ? (
          <>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button onClick={onSubmit} loading={submitting}>
              Confirm and submit
            </Button>
          </>
        ) : (
          <Button
            disabled={!selected}
            onClick={() => setConfirming(true)}
          >
            Continue
          </Button>
        )}
      </div>
    </main>
  );
}
