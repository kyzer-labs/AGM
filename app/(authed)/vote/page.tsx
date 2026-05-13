"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ArrowRight, Check, CheckCircle2, Scale } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { CandidatePhoto } from "@/components/candidate-photo";
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

  if (election.phase === "resultsPreview" || election.phase === "published") {
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
        <header
          className="tile-enter space-y-4"
          style={{ ["--index" as never]: 0 }}
        >
          <SectionMarker
            primary="Live ballot"
            secondary={
              <>
                Tier {session.tier}{" "}
                <span aria-hidden className="text-[var(--copper)]">
                  .
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
          className="tile-enter flex items-center gap-3 border-t border-[var(--ink-line)] pt-6"
          style={{ ["--index" as never]: 1 }}
          role="status"
        >
          <CheckCircle2
            className="h-5 w-5 text-[var(--color-success)]"
            aria-hidden
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Recorded {formatMYT(myVote.votedAt)}
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
    <main className="h-[calc(100dvh-73px)] overflow-hidden">
      <section className="mx-auto flex h-[calc(100%_-_4.75rem)] w-full max-w-[76rem] flex-col px-3 pb-3 pt-4 sm:h-[calc(100%_-_5rem)] sm:px-5 sm:pt-5 lg:px-6 lg:pb-4">
        <header className="mx-auto shrink-0 text-center">
          <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.36em] text-[var(--copper)] sm:text-[0.68rem]">
            Public voting
          </p>
          <h1 className="mt-1 font-serif text-[1.75rem] font-semibold leading-[0.95] tracking-[-0.01em] text-[var(--ink)] sm:text-[2.4rem] lg:text-[2.7rem]">
            Vote for {session.name}
          </h1>
          <div className="mx-auto mt-2 flex max-w-[24rem] items-center gap-3 text-[var(--copper)] sm:mt-3">
            <span className="h-px flex-1 bg-[var(--ink-line)]" />
            <Scale className="h-4 w-4 shrink-0 stroke-[1.6] sm:h-5 sm:w-5" aria-hidden />
            <span className="h-px flex-1 bg-[var(--ink-line)]" />
          </div>
          <p className="mt-2 font-serif text-[0.86rem] leading-tight text-[var(--ink)] sm:text-[0.95rem]">
            Pick exactly one (1) candidate.
          </p>
          <p className="sr-only">
            Tier {session.tier}
            {session.sessionStartedAt
              ? `, opened ${formatMYTTimeOnly(session.sessionStartedAt)}`
              : ""}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center pt-3 sm:pt-4 lg:pt-5">
          <div
            role="radiogroup"
            aria-label={`Candidates for ${session.name}`}
            className="grid w-full max-w-[72rem] justify-center gap-2.5 sm:gap-3 lg:gap-4 [grid-template-columns:repeat(auto-fit,minmax(15.75rem,16.85rem))]"
            key={session.positionId}
          >
            {session.candidates.map((candidate, idx) => (
              <CandidateBallotCard
                key={candidate.candidateId}
                candidate={candidate}
                disabled={confirming}
                index={idx}
                isSelected={selected === candidate.candidateId}
                positionName={session.name}
                onSelect={() => {
                  if (confirming) return;
                  setSelected(candidate.candidateId);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <SelectionDock
        chosen={chosen}
        confirming={confirming}
        positionName={session.name}
        submitting={submitting}
        onBack={() => setConfirming(false)}
        onContinue={() => setConfirming(true)}
        onSubmit={onSubmit}
      />
    </main>
  );
}

type BallotCandidate = ActiveSession["candidates"][number];

function CandidateBallotCard({
  candidate,
  disabled,
  index,
  isSelected,
  positionName,
  onSelect,
}: {
  candidate: BallotCandidate;
  disabled: boolean;
  index: number;
  isSelected: boolean;
  positionName: string;
  onSelect: () => void;
}) {
  const matric = displayMatric(candidate.matric);
  const ticketNumber = String(index + 1).padStart(3, "0");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${candidate.fullName}, ${positionName}`}
      disabled={disabled}
      onClick={onSelect}
      style={{ ["--index" as never]: index }}
      className={cn(
        "ticket-card tile-enter group relative grid min-h-[6.9rem] w-full grid-cols-[4.6rem_minmax(0,1fr)_2.25rem] items-center overflow-visible border-0 bg-transparent text-left",
        "px-3.5 py-2 shadow-none transition-[filter,transform] duration-200",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)] active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        "disabled:cursor-not-allowed disabled:opacity-75",
        "sm:min-h-[8rem] sm:grid-cols-[5.7rem_minmax(0,1fr)_3rem] sm:px-4 sm:py-2.5",
        "lg:flex lg:h-[25.4rem] lg:min-h-0 lg:flex-col lg:items-stretch lg:px-4 lg:pb-3.5 lg:pt-4",
        isSelected
          ? "ticket-card-selected drop-shadow-[0_10px_20px_rgba(15,106,106,0.14)]"
          : "drop-shadow-[0_7px_16px_rgba(40,30,20,0.08)] hover:drop-shadow-[0_10px_18px_rgba(40,30,20,0.1)]",
      )}
    >
      <TicketBorder selected={isSelected} />
      <SelectedStamp visible={isSelected} />

      <span className="absolute left-4 top-4 z-10 hidden font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--copper)] lg:block">
        {ticketNumber}
      </span>

      <div className="relative z-10 aspect-[3/4] h-[5.65rem] justify-self-start overflow-hidden bg-[var(--paper-2)] ring-1 ring-[var(--ink-line)] sm:h-[6.95rem] lg:mt-8 lg:h-auto lg:w-full">
        <CandidatePhoto
          src={candidate.photoUrl}
          alt={candidate.fullName}
          className="h-full w-full object-cover object-top"
          iconClassName="mx-auto h-12 w-12"
          loading={index === 0 ? "eager" : "lazy"}
        />
      </div>

      <div className="relative z-10 min-w-0 self-start px-2 py-1 sm:px-4 sm:py-2 lg:px-0 lg:pb-2 lg:pt-2.5">
        <div className="mb-0.5 flex items-center gap-2 lg:hidden">
          <span className="font-mono text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-[var(--copper)] sm:text-[0.6rem]">
            {ticketNumber}
          </span>
          <span className="h-px flex-1 border-t border-dashed border-[var(--ink-line)]" />
        </div>
        <h2 className="font-serif text-[0.78rem] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-[var(--ink)] sm:text-[1rem] lg:text-[1.08rem]">
          {candidate.fullName}
        </h2>
        <div className="mt-1.5 max-w-[24.5rem] border-t border-dashed border-[var(--ink-line)]" />
        <dl className="mt-1.5 grid gap-1 sm:mt-2">
          {matric ? (
            <div>
              <dt className="font-mono text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-[var(--copper)] sm:text-[0.54rem]">
                Matric number
              </dt>
              <dd className="mt-0.5 font-serif text-[0.66rem] leading-tight text-[var(--ink)] sm:text-[0.78rem]">
                {matric}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-mono text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-[var(--copper)] sm:text-[0.54rem]">
              Position contested
            </dt>
            <dd className="mt-0.5 line-clamp-2 font-serif text-[0.66rem] leading-tight text-[var(--ink)] sm:text-[0.78rem]">
              {positionName}
            </dd>
          </div>
        </dl>
      </div>

      <RadioMark checked={isSelected} />
    </button>
  );
}

function TicketBorder({ selected }: { selected: boolean }) {
  const stroke = selected ? "var(--teal)" : "var(--ink-line)";
  const softStroke = selected
    ? "color-mix(in oklab, var(--teal) 42%, transparent)"
    : "color-mix(in oklab, var(--ink-line) 62%, transparent)";

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 160"
    >
      <path
        d={TICKET_FILL_PATH}
        fill={
          selected
            ? "color-mix(in oklab, var(--teal) 7%, var(--paper))"
            : "var(--paper)"
        }
      />
      <path
        d={TICKET_BORDER_PATH}
        fill="none"
        stroke={softStroke}
        strokeDasharray="1.2 2.4"
        strokeWidth="0.55"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={TICKET_BORDER_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? "0.95" : "0.68"}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M 8 33 H 92"
        fill="none"
        stroke="var(--ink-line)"
        strokeDasharray="1.2 2.4"
        strokeWidth="0.55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const TICKET_FILL_PATH =
  "M 6 2 Q 8.5 4.2 11 2 Q 13.5 4.2 16 2 Q 18.5 4.2 21 2 Q 23.5 4.2 26 2 Q 28.5 4.2 31 2 Q 33.5 4.2 36 2 Q 38.5 4.2 41 2 Q 43.5 4.2 46 2 Q 48.5 4.2 51 2 Q 53.5 4.2 56 2 Q 58.5 4.2 61 2 Q 63.5 4.2 66 2 Q 68.5 4.2 71 2 Q 73.5 4.2 76 2 Q 78.5 4.2 81 2 Q 83.5 4.2 86 2 Q 88.5 4.2 91 2 L 98 2 Q 95.8 4.5 98 7 Q 95.8 9.5 98 12 Q 95.8 14.5 98 17 Q 95.8 19.5 98 22 Q 95.8 24.5 98 27 Q 95.8 29.5 98 32 Q 95.8 34.5 98 37 Q 95.8 39.5 98 42 Q 95.8 44.5 98 47 Q 95.8 49.5 98 52 Q 95.8 54.5 98 57 Q 95.8 59.5 98 62 Q 95.8 64.5 98 67 Q 95.8 69.5 98 72 Q 95.8 74.5 98 77 Q 95.8 79.5 98 82 Q 95.8 84.5 98 87 Q 95.8 89.5 98 92 Q 95.8 94.5 98 97 Q 95.8 99.5 98 102 Q 95.8 104.5 98 107 Q 95.8 109.5 98 112 Q 95.8 114.5 98 117 Q 95.8 119.5 98 122 Q 95.8 124.5 98 127 Q 95.8 129.5 98 132 Q 95.8 134.5 98 137 Q 95.8 139.5 98 142 Q 95.8 144.5 98 147 Q 95.8 149.5 98 152 L 98 158 Q 95.5 155.8 93 158 Q 90.5 155.8 88 158 Q 85.5 155.8 83 158 Q 80.5 155.8 78 158 Q 75.5 155.8 73 158 Q 70.5 155.8 68 158 Q 65.5 155.8 63 158 Q 60.5 155.8 58 158 Q 55.5 155.8 53 158 Q 50.5 155.8 48 158 Q 45.5 155.8 43 158 Q 40.5 155.8 38 158 Q 35.5 155.8 33 158 Q 30.5 155.8 28 158 Q 25.5 155.8 23 158 Q 20.5 155.8 18 158 Q 15.5 155.8 13 158 Q 10.5 155.8 8 158 L 2 158 Q 4.2 155.5 2 153 Q 4.2 150.5 2 148 Q 4.2 145.5 2 143 Q 4.2 140.5 2 138 Q 4.2 135.5 2 133 Q 4.2 130.5 2 128 Q 4.2 125.5 2 123 Q 4.2 120.5 2 118 Q 4.2 115.5 2 113 Q 4.2 110.5 2 108 Q 4.2 105.5 2 103 Q 4.2 100.5 2 98 Q 4.2 95.5 2 93 Q 4.2 90.5 2 88 Q 4.2 85.5 2 83 Q 4.2 80.5 2 78 Q 4.2 75.5 2 73 Q 4.2 70.5 2 68 Q 4.2 65.5 2 63 Q 4.2 60.5 2 58 Q 4.2 55.5 2 53 Q 4.2 50.5 2 48 Q 4.2 45.5 2 43 Q 4.2 40.5 2 38 Q 4.2 35.5 2 33 Q 4.2 30.5 2 28 Q 4.2 25.5 2 23 Q 4.2 20.5 2 18 Q 4.2 15.5 2 13 Q 4.2 10.5 2 8 L 2 2 Z";

const TICKET_BORDER_PATH = TICKET_FILL_PATH;

function SelectedStamp({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-2.5 top-2.5 z-30 hidden h-14 w-14 rotate-[-14deg] place-items-center rounded-full border border-dashed border-[var(--teal)]",
        "bg-[color-mix(in_oklab,var(--paper)_74%,transparent)] font-mono text-[0.49rem] font-semibold uppercase tracking-[0.06em] text-[var(--teal)] shadow-[0_4px_12px_rgba(15,106,106,0.13)] backdrop-blur-[1px]",
        "before:absolute before:inset-[5px] before:rounded-full before:border before:border-[var(--teal)]",
        "after:absolute after:inset-[11px] after:rounded-full after:border after:border-dashed after:border-[color-mix(in_oklab,var(--teal)_68%,transparent)]",
        visible ? "grid" : null,
      )}
    >
      <span className="relative z-10">Selected</span>
    </span>
  );
}

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 grid h-6 w-6 place-items-center justify-self-center rounded-full border bg-[var(--paper)] sm:h-8 sm:w-8 sm:justify-self-center lg:mt-auto lg:h-9 lg:w-9 lg:self-center",
        checked
          ? "border-[var(--teal)] shadow-[inset_0_0_0_4px_var(--paper)]"
          : "border-[color-mix(in_oklab,var(--ink)_65%,var(--paper))]",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-[var(--teal)] transition-transform duration-200 sm:h-5 sm:w-5 lg:h-5 lg:w-5",
          checked ? "scale-100" : "scale-0",
        )}
      />
    </span>
  );
}

function SelectionDock({
  chosen,
  confirming,
  positionName,
  submitting,
  onBack,
  onContinue,
  onSubmit,
}: {
  chosen: BallotCandidate | undefined;
  confirming: boolean;
  positionName: string;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
}) {
  const matric = displayMatric(chosen?.matric);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color-mix(in_oklab,var(--copper)_62%,var(--ink-line))] bg-[color-mix(in_oklab,var(--paper)_96%,transparent)] px-4 py-2 shadow-[0_-18px_45px_rgba(40,30,20,0.1)] backdrop-blur-sm"
      role="region"
      aria-label="Cast your vote"
    >
      <div className="mx-auto flex max-w-[68rem] items-center gap-3 sm:gap-5">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-12 sm:w-12",
            chosen
              ? "bg-[var(--teal)] text-[var(--paper)]"
              : "border border-[var(--ink-line)] text-[var(--ink-muted)]",
          )}
          aria-hidden
        >
          <Check className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>

        <div className="hidden h-10 w-px bg-[var(--ink-line)] sm:block" />

        <div className="hidden min-w-[9rem] sm:block">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
            Current selection
          </p>
        </div>

        {chosen ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden aspect-[3/4] h-[4rem] shrink-0 overflow-hidden rounded-[3px] border border-[var(--ink-line)] bg-[var(--paper-2)] sm:block">
              <CandidatePhoto
                src={chosen.photoUrl}
                alt=""
                className="h-full w-full object-cover object-top"
                iconClassName="mx-auto h-8 w-8"
              />
            </div>
            <div className="min-w-0">
              {confirming ? (
                <p className="mb-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
                  Selected
                </p>
              ) : null}
              <p className="truncate font-serif text-[1rem] font-semibold uppercase leading-tight text-[var(--ink)] sm:text-[1.25rem]">
                {chosen.fullName}
              </p>
              <p className="truncate font-serif text-[0.86rem] leading-tight text-[var(--ink)] sm:text-[0.95rem]">
                {matric ? (
                  <>
                    {matric}
                    <span className="mx-2 text-[var(--copper)]">.</span>
                  </>
                ) : null}
                {positionName}
              </p>
              {confirming ? (
                <p className="mt-1 hidden text-xs leading-relaxed text-[var(--ink-muted)] sm:block">
                  This vote is final once submitted.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            Pick a candidate above to continue
          </p>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <Button
                variant="outline"
                onClick={onBack}
                disabled={submitting}
                className="h-10 rounded-[3px] border-[var(--ink-line)] bg-[var(--paper)] px-4 font-serif text-sm"
              >
                Back
              </Button>
              <Button
                onClick={onSubmit}
                loading={submitting}
                className="h-10 rounded-[3px] bg-[var(--teal)] px-4 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:px-7"
              >
                Submit
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button
              disabled={!chosen}
              onClick={onContinue}
              className="h-10 rounded-[3px] bg-[var(--teal)] px-4 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:h-12 sm:px-8 sm:text-base"
            >
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function displayMatric(matric: string | null | undefined): string | null {
  if (!matric || matric.startsWith("auto-")) return null;
  return matric;
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
