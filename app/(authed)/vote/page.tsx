"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { CheckCircle2, UserCircle2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Standby as StandbyBlock } from "@/components/ui/standby";
import { cn } from "@/lib/utils";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT, formatMYTTimeOnly } from "@/lib/format";
import { getWeights, internalSharePercent } from "@/lib/weights";
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
  if (election === undefined) return <PageSkeleton />;
  if (election === null) {
    return (
      <Standby
        cycleName={null}
        phase="No active cycle"
        body="The AGM is not yet in session. This page activates automatically the moment public voting opens."
      />
    );
  }
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const internalStatus = useQuery(api.internal.myStatus, {
    electionId: election._id,
  });

  const isAdmin = me?.role === "admin" || me?.role === "super";

  useEffect(() => {
    if (me === undefined || internalStatus === undefined) return;
    if (isAdmin) return;
    if (internalStatus.isWhitelisted) {
      router.replace("/dashboard");
      return;
    }
    if (election.phase !== "publicVoting") {
      router.replace("/dashboard");
    }
  }, [me, internalStatus, isAdmin, election.phase, router]);

  if (internalStatus === undefined || me === undefined) {
    return <PageSkeleton />;
  }

  if (internalStatus.isWhitelisted) {
    if (!isAdmin) return <PageSkeleton />;
    const internalShare = internalSharePercent(getWeights(election));
    return (
      <Standby
        cycleName={election.name}
        phase="Internal evaluators do not vote here"
        body={`You are listed as a Year 2 internal evaluator for this cycle. Your input flows through the internal rubric (${internalShare}% of the final result). Public voting is reserved for external members.`}
      />
    );
  }

  if (
    election.phase === "setup" ||
    election.phase === "internalOpen" ||
    election.phase === "internalClosed"
  ) {
    if (!isAdmin) return <PageSkeleton />;
    return (
      <Standby
        cycleName={election.name}
        phase="Public voting not yet open"
        body="Public AGM voting begins when the chairperson opens the first ballot. Stay on this page; it updates live the moment voting starts."
      />
    );
  }

  if (
    election.phase === "resultsPreview" ||
    election.phase === "published"
  ) {
    if (!isAdmin) return <PageSkeleton />;
    return (
      <Standby
        cycleName={election.name}
        phase="Voting closed"
        body="All ballots are closed. Final results appear on the Results page once the chairperson publishes them."
      />
    );
  }

  return <Live election={election} />;
}

function Live({ election }: { election: Doc<"elections"> }) {
  const active = useQuery(api.sessions.getActiveSession, {
    electionId: election._id,
  });

  if (active === undefined) {
    return <PageSkeleton />;
  }

  if (active === null) {
    return (
      <Standby
        cycleName={election.name}
        phase="Waiting for the next ballot"
        body="The chairperson will open the next position momentarily. Keep this tab open. The ballot appears here automatically the moment it opens."
      />
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
    return <PageSkeleton />;
  }

  if (myVote) {
    const chosen = session.candidates.find(
      (c) => c.candidateId === myVote.candidateId,
    );
    return (
      <main className="container-narrow space-y-8 py-16 sm:py-20">
        <header className="space-y-4">
          <SectionMarker
            primary="Live ballot"
            secondary={
              <>
                Tier {session.tier}{" "}
                <span aria-hidden className="text-[var(--copper)]">
                  ·
                </span>{" "}
                {session.name}
              </>
            }
          />
          <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
            Vote recorded
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--ink)]">
            Your vote for{" "}
            <strong className="font-semibold">
              {chosen?.fullName ?? "your choice"}
            </strong>{" "}
            has been recorded for{" "}
            <strong className="font-semibold">{session.name}</strong>. This
            vote is final.
          </p>
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Keep this tab open. The next ballot appears here automatically the
            moment the chairperson opens it.
          </p>
        </header>

        <div
          className="flex items-center gap-3 border-t border-[var(--ink-line)] pt-6"
          role="status"
        >
          <CheckCircle2
            className="h-5 w-5 text-[var(--color-success)]"
            aria-hidden
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Recorded {formatMYT(Date.now())}
          </p>
        </div>
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
      const m = getConvexErrorMessage(err, "Could not record your vote.");
      toast.error("Vote failed", { description: m });
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const chosen = session.candidates.find((c) => c.candidateId === selected);

  return (
    <main className="container-wide space-y-10 py-12">
      <header className="space-y-3">
        <SectionMarker
          primary="Live ballot"
          secondary={
            <>
              Tier {session.tier}
              {session.sessionStartedAt ? (
                <>
                  {" "}
                  <span aria-hidden className="text-[var(--copper)]">
                    ·
                  </span>{" "}
                  Opened {formatMYTTimeOnly(session.sessionStartedAt)}
                </>
              ) : null}
            </>
          }
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Vote for {session.name}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Pick exactly one candidate. Once submitted, your vote is final. It
          cannot be changed or withdrawn.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label={`Candidates for ${session.name}`}
        className="grid gap-3 sm:grid-cols-2 md:grid-cols-3"
      >
        {session.candidates.map((c) => {
          const isSelected = selected === c.candidateId;
          return (
            <button
              key={c.candidateId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                if (confirming) return;
                setSelected(c.candidateId);
              }}
              disabled={confirming}
              className={cn(
                "flex h-full flex-col items-start rounded-lg border bg-[var(--color-card)] p-4 text-left",
                "transition-[transform,border-color,box-shadow] duration-200",
                "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                "disabled:cursor-not-allowed disabled:opacity-70",
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
                    <div className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
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
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  {c.bio}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "sticky bottom-4 z-20 rounded-lg border bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur",
          "shadow-[0_-12px_40px_-8px_rgba(15,106,106,0.18)]",
          confirming ? "space-y-3" : null,
        )}
        role="region"
        aria-label="Cast your vote"
      >
        {confirming && chosen ? (
          <div className="space-y-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--color-destructive)]">
              This vote is final
            </p>
            <p className="text-sm leading-relaxed text-[var(--ink)]">
              Voting for{" "}
              <strong className="font-semibold">{chosen.fullName}</strong>{" "}
              <span className="text-[var(--color-muted-foreground)]">
                {chosen.matric && !chosen.matric.startsWith("auto-")
                  ? `(${chosen.matric}) `
                  : ""}
              </span>
              as <strong className="font-semibold">{session.name}</strong>.
              Once submitted, this vote cannot be changed or withdrawn.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {!confirming && chosen ? (
            <span className="text-sm">
              Selected:{" "}
              <strong className="font-semibold">{chosen.fullName}</strong>
              {chosen.matric && !chosen.matric.startsWith("auto-") ? (
                <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                  {chosen.matric}
                </span>
              ) : null}
            </span>
          ) : null}
          {!confirming && !chosen ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Pick a candidate above to continue
            </span>
          ) : null}
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
      </div>
    </main>
  );
}

function PageSkeleton() {
  return (
    <main className="container-narrow space-y-6 py-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-40 w-full" />
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
      markerPrimary="AGM voting"
      markerSecondary={phase}
      cycleName={cycleName}
      body={body}
    />
  );
}

