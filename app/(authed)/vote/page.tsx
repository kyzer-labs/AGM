"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Scale,
  ShieldCheck,
} from "lucide-react";

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
      <section className="mx-auto flex h-[calc(100%_-_5.75rem)] w-full max-w-[94vw] flex-col px-3 pb-3 pt-3 sm:h-[calc(100%_-_6.25rem)] sm:px-5 sm:pt-4 lg:px-6 lg:pb-4">
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


        <div className="flex min-h-0 flex-1 items-center justify-center pt-0.5">
          <div
            role="radiogroup"
            aria-label={`Candidates for ${session.name}`}
            className="grid w-full justify-center gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(clamp(19rem,22vw,25rem),clamp(21rem,25vw,27rem)))]"
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
        "ticket-card tile-enter group relative grid min-h-[8.2rem] w-full grid-cols-[5.4rem_minmax(0,1fr)_2.8rem] items-center overflow-visible border-0 bg-transparent text-left",
        "px-4 py-2 shadow-none transition-[filter,transform] duration-200",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)] active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        "disabled:cursor-not-allowed disabled:opacity-75",
        "sm:min-h-[9rem] sm:grid-cols-[7rem_minmax(0,1fr)_3.25rem] sm:px-4 sm:py-2.5",
        "lg:flex lg:h-[clamp(30rem,61vh,39rem)] lg:min-h-0 lg:flex-col lg:items-stretch lg:px-[1.3rem] lg:pb-4 lg:pt-[1.125rem]",
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


      <div className="relative z-10 aspect-[3/4] h-[6.6rem] justify-self-start overflow-hidden bg-[var(--paper-2)] ring-1 ring-[var(--ink-line)] sm:h-[8rem] lg:mt-[2.2rem] lg:h-auto lg:w-full">
        <CandidatePhoto
          src={candidate.photoUrl}
          alt={candidate.fullName}
          className="h-full w-full object-contain"
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
        <h2 className="font-serif text-[0.78rem] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-[var(--ink)] sm:text-[1rem] lg:text-[1.14rem]">
          {candidate.fullName}
        </h2>
        <div className="mt-1.5 max-w-[24.5rem] border-t border-dashed border-[var(--ink-line)]" />
        <div className="mt-2 grid gap-1 sm:mt-2.5 sm:gap-1.5">
          {matric ? (
            <p className="truncate font-mono text-[0.72rem] font-semibold uppercase tracking-[0.045em] text-[var(--teal)] sm:text-[0.86rem] lg:text-[0.9rem]">
              {matric}
            </p>
          ) : null}
          <p className="line-clamp-2 font-serif text-[0.78rem] font-medium leading-[1.12] text-[var(--ink)] sm:text-[0.92rem] lg:text-[0.98rem]">
            {positionName}
          </p>
        </div>
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
        "pointer-events-none absolute right-[0.65rem] top-2 z-30 hidden h-[4.5rem] w-[4.5rem] rotate-[-14deg] place-items-center rounded-full border border-dashed border-[var(--teal)]",
        "bg-[color-mix(in_oklab,var(--paper)_74%,transparent)] font-mono text-[0.56rem] font-semibold uppercase tracking-[0.06em] text-[var(--teal)] shadow-[0_4px_12px_rgba(15,106,106,0.13)] backdrop-blur-[1px]",
        "before:absolute before:inset-[5px] before:rounded-full before:border before:border-[var(--teal)]",
        "after:absolute after:inset-[11px] after:rounded-full after:border after:border-dashed after:border-[color-mix(in_oklab,var(--teal)_68%,transparent)]",
        "lg:right-[0.45rem] lg:top-[0.25rem] lg:h-[6.6rem] lg:w-[6.6rem] lg:text-[0.78rem]",
        "lg:before:inset-[7px] lg:after:inset-[17px]",
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
        "relative z-10 grid h-7 w-7 place-items-center justify-self-center rounded-full border sm:h-8 sm:w-8 sm:justify-self-center lg:mt-auto lg:h-10 lg:w-10 lg:self-center",
        "transition-[border-color,box-shadow,background-color,color] duration-200",
        checked
          ? "hidden border-[var(--teal)] bg-[var(--teal)] text-[var(--paper)] shadow-[0_2px_8px_rgba(15,106,106,0.18)] sm:grid"
          : "border-[color-mix(in_oklab,var(--ink)_58%,var(--paper))] bg-[var(--paper)] text-transparent shadow-[inset_0_0_0_3px_var(--paper)]",
      )}
    >
      <Check
        className={cn(
          "h-3.5 w-3.5 stroke-[2.4] transition-[opacity,transform] duration-200 sm:h-4 sm:w-4 lg:h-5 lg:w-5",
          checked ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      />
    </span>
  );
}

function SelectionDock({
  chosen,
  confirming,
  submitting,
  onBack,
  onContinue,
  onSubmit,
}: {
  chosen: BallotCandidate | undefined;
  confirming: boolean;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-2 z-30 px-3 sm:bottom-3"
      role="region"
      aria-label="Cast your vote"
    >
      <div className="relative mx-auto grid min-h-[6.15rem] max-w-[46rem] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 pl-3 pr-4 drop-shadow-[0_12px_28px_rgba(40,30,20,0.13)] sm:min-h-[6.4rem] sm:grid-cols-[2.35rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5 sm:py-3">
        <LandscapeTicketBorder active={Boolean(chosen)} />

        <div className="relative z-10 flex h-full items-center justify-center border-r border-dashed border-[var(--ink-line)] pr-2">
          <span className="[writing-mode:vertical-rl] rotate-180 font-mono text-[0.52rem] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Detach here
          </span>
        </div>

        <div className="relative z-10 min-w-0">
          {chosen ? (
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="aspect-[3/4] h-[4.9rem] shrink-0 overflow-hidden rounded-[2px] border border-[var(--ink-line)] bg-[var(--paper-2)] shadow-[0_5px_12px_rgba(40,30,20,0.12)] sm:h-[5.2rem]">
                <CandidatePhoto
                  src={chosen.photoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  iconClassName="mx-auto h-8 w-8"
                />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-[var(--teal)] sm:text-[0.56rem]">
                  Selected candidate
                </p>
                <p className="truncate font-serif text-[0.88rem] font-semibold uppercase leading-tight text-[var(--ink)] sm:text-[1.02rem]">
                  {chosen.fullName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-serif text-[0.72rem] leading-tight text-[var(--ink-muted)] sm:text-[0.8rem]">
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 stroke-[1.8] text-[var(--ink-muted)] sm:h-4 sm:w-4"
                    aria-hidden
                  />
                  This vote is final.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--ink-muted)]">
                <Check className="h-5 w-5" aria-hidden />
              </div>
              <p className="min-w-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Pick a candidate above to continue
              </p>
            </div>
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <Button
                variant="outline"
                onClick={onBack}
                disabled={submitting}
                className="h-10 rounded-[3px] border-[var(--ink-line)] bg-[var(--paper)] px-3 font-serif text-sm sm:px-4"
              >
                Back
              </Button>
              <Button
                onClick={onSubmit}
                loading={submitting}
                className="h-10 rounded-[3px] bg-[var(--teal)] px-3 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:px-6"
              >
                Submit
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button
              disabled={!chosen}
              onClick={onContinue}
              className="h-10 rounded-[3px] bg-[var(--teal)] px-3 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:h-11 sm:px-7 sm:text-base"
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

function LandscapeTicketBorder({ active }: { active: boolean }) {
  const stroke = active ? "var(--teal)" : "var(--ink-line)";
  const softStroke = active
    ? "color-mix(in oklab, var(--teal) 36%, transparent)"
    : "color-mix(in oklab, var(--ink-line) 58%, transparent)";

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 220 70"
    >
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill={
          active
            ? "color-mix(in oklab, var(--teal) 5%, var(--paper))"
            : "var(--paper)"
        }
      />
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill="none"
        stroke={softStroke}
        strokeDasharray="1.4 2.8"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={active ? "0.9" : "0.65"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const LANDSCAPE_TICKET_PATH =
  "M 5 2 Q 7.5 4.2 10 2 Q 12.5 4.2 15 2 Q 17.5 4.2 20 2 Q 22.5 4.2 25 2 Q 27.5 4.2 30 2 Q 32.5 4.2 35 2 Q 37.5 4.2 40 2 Q 42.5 4.2 45 2 Q 47.5 4.2 50 2 Q 52.5 4.2 55 2 Q 57.5 4.2 60 2 Q 62.5 4.2 65 2 Q 67.5 4.2 70 2 Q 72.5 4.2 75 2 Q 77.5 4.2 80 2 Q 82.5 4.2 85 2 Q 87.5 4.2 90 2 Q 92.5 4.2 95 2 Q 97.5 4.2 100 2 Q 102.5 4.2 105 2 Q 107.5 4.2 110 2 Q 112.5 4.2 115 2 Q 117.5 4.2 120 2 Q 122.5 4.2 125 2 Q 127.5 4.2 130 2 Q 132.5 4.2 135 2 Q 137.5 4.2 140 2 Q 142.5 4.2 145 2 Q 147.5 4.2 150 2 Q 152.5 4.2 155 2 Q 157.5 4.2 160 2 Q 162.5 4.2 165 2 Q 167.5 4.2 170 2 Q 172.5 4.2 175 2 Q 177.5 4.2 180 2 Q 182.5 4.2 185 2 Q 187.5 4.2 190 2 Q 192.5 4.2 195 2 Q 197.5 4.2 200 2 Q 202.5 4.2 205 2 Q 207.5 4.2 210 2 Q 212.5 4.2 215 2 L 218 2 Q 215.8 4.5 218 7 Q 215.8 9.5 218 12 Q 215.8 14.5 218 17 Q 215.8 19.5 218 22 Q 215.8 24.5 218 27 Q 215.8 29.5 218 32 Q 215.8 34.5 218 37 Q 215.8 39.5 218 42 Q 215.8 44.5 218 47 Q 215.8 49.5 218 52 Q 215.8 54.5 218 57 Q 215.8 59.5 218 62 L 218 68 Q 215.5 65.8 213 68 Q 210.5 65.8 208 68 Q 205.5 65.8 203 68 Q 200.5 65.8 198 68 Q 195.5 65.8 193 68 Q 190.5 65.8 188 68 Q 185.5 65.8 183 68 Q 180.5 65.8 178 68 Q 175.5 65.8 173 68 Q 170.5 65.8 168 68 Q 165.5 65.8 163 68 Q 160.5 65.8 158 68 Q 155.5 65.8 153 68 Q 150.5 65.8 148 68 Q 145.5 65.8 143 68 Q 140.5 65.8 138 68 Q 135.5 65.8 133 68 Q 130.5 65.8 128 68 Q 125.5 65.8 123 68 Q 120.5 65.8 118 68 Q 115.5 65.8 113 68 Q 110.5 65.8 108 68 Q 105.5 65.8 103 68 Q 100.5 65.8 98 68 Q 95.5 65.8 93 68 Q 90.5 65.8 88 68 Q 85.5 65.8 83 68 Q 80.5 65.8 78 68 Q 75.5 65.8 73 68 Q 70.5 65.8 68 68 Q 65.5 65.8 63 68 Q 60.5 65.8 58 68 Q 55.5 65.8 53 68 Q 50.5 65.8 48 68 Q 45.5 65.8 43 68 Q 40.5 65.8 38 68 Q 35.5 65.8 33 68 Q 30.5 65.8 28 68 Q 25.5 65.8 23 68 Q 20.5 65.8 18 68 Q 15.5 65.8 13 68 Q 10.5 65.8 8 68 L 2 68 Q 4.2 65.5 2 63 Q 4.2 60.5 2 58 Q 4.2 55.5 2 53 Q 4.2 50.5 2 48 Q 4.2 45.5 2 43 Q 4.2 40.5 2 38 Q 4.2 35.5 2 33 Q 4.2 30.5 2 28 Q 4.2 25.5 2 23 Q 4.2 20.5 2 18 Q 4.2 15.5 2 13 Q 4.2 10.5 2 8 L 2 2 Z";

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
