"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Pencil,
  Save,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Standby as StandbyBlock } from "@/components/ui/standby";
import { ScoreButtons } from "@/components/internal/score-buttons";
import { RubricHelp } from "@/components/internal/rubric-help";
import { matchRubricCategory } from "@/lib/rubric-categories";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { getWeights, internalSharePercent } from "@/lib/weights";
import { cn } from "@/lib/utils";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

type ScoreMap = Map<string, number>;

function scoreKey(
  candidateId: Id<"candidates">,
  criterionId: Id<"rubricCriteria">,
): string {
  return `${candidateId}::${criterionId}`;
}

export default function InternalPage() {
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
        body="No election is in progress. The internal evaluation surface activates the moment admins create an AGM cycle and open the rubric window."
      />
    );
  }
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const status = useQuery(api.internal.myStatus, {
    electionId: election._id,
  });

  const isAdmin = me?.role === "admin" || me?.role === "super";

  useEffect(() => {
    if (me === undefined || status === undefined) return;
    if (isAdmin) return;
    if (!status.isWhitelisted) {
      router.replace("/dashboard");
      return;
    }
    if (election.phase === "setup") {
      router.replace("/dashboard");
    }
  }, [me, status, isAdmin, election.phase, router]);

  if (status === undefined || me === undefined) {
    return <PageSkeleton />;
  }

  if (!status.isWhitelisted) {
    if (!isAdmin) return <PageSkeleton />;
    return (
      <Standby
        cycleName={election.name}
        phase="Internal access denied"
        body="Internal evaluation is restricted to committee members on the whitelist for this cycle. You will vote externally during the live AGM. If this looks wrong, contact the AGM admin team."
      />
    );
  }

  if (election.phase === "setup") {
    if (!isAdmin) return <PageSkeleton />;
    return (
      <Standby
        cycleName={election.name}
        phase="Internal evaluation not open"
        body="Admins are still configuring this cycle. The rubric activates the moment the internal evaluation window opens."
      />
    );
  }

  if (
    election.phase === "internalClosed" ||
    election.phase === "publicVoting" ||
    election.phase === "resultsPreview" ||
    election.phase === "published"
  ) {
    return (
      <Standby
        cycleName={election.name}
        phase="Internal evaluation closed"
        body={
          status.evaluationStatus === "submitted" && status.submittedAt
            ? `Your evaluation was submitted on ${formatMYT(status.submittedAt)}. Scores are locked for this cycle.`
            : "The internal window is closed. New scores can no longer be saved or edited for this cycle."
        }
      />
    );
  }

  return (
    <ActiveEvaluation
      election={election}
      voterClass={status.voterClass as VoterClass | null}
      voterClassWeight={status.voterClassWeight}
    />
  );
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12">
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-72 w-full" />
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
      markerPrimary="Internal evaluation"
      markerSecondary={phase}
      cycleName={cycleName}
      body={body}
    />
  );
}

type View = "score" | "review";

interface CandidateRow {
  _id: Id<"candidates">;
  fullName: string;
  matric: string | null;
  photoUrl: string | null;
  positions: { name: string; fallbackOrder: number }[];
}

function ActiveEvaluation({
  election,
  voterClass,
  voterClassWeight,
}: {
  election: Doc<"elections">;
  voterClass: VoterClass | null;
  voterClassWeight: number;
}) {
  const dialog = useDialog();
  const evaluation = useQuery(api.internal.myEvaluation, {
    electionId: election._id,
  });
  const candidates = useQuery(api.candidates.list, {
    electionId: election._id,
  });
  const saveScores = useMutation(api.internal.saveScores);
  const submit = useMutation(api.internal.submit);
  const unsubmit = useMutation(api.internal.unsubmit);

  const [local, setLocal] = useState<ScoreMap>(new Map());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [view, setView] = useState<View>("score");
  const [activeCriterionIdx, setActiveCriterionIdx] = useState(0);

  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!evaluation) return;
    const key = `${evaluation.evaluationId ?? "new"}-${evaluation.scores.length}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    const next: ScoreMap = new Map();
    for (const s of evaluation.scores) {
      next.set(scoreKey(s.candidateId, s.criterionId), s.score);
    }
    setLocal(next);
    setDirty(false);
    if (evaluation.submittedAt) setLastSavedAt(evaluation.submittedAt);
  }, [evaluation]);

  const isSubmitted = evaluation?.status === "submitted";
  const editable = !isSubmitted;

  const totals = useMemo(() => {
    if (!candidates || !evaluation)
      return { complete: 0, total: 0, criteriaCount: 0 };
    const criteriaCount = evaluation.criteria.length;
    let complete = 0;
    for (const c of candidates) {
      const allFilled = evaluation.criteria.every(
        (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
      );
      if (allFilled) complete += 1;
    }
    return { complete, total: candidates.length, criteriaCount };
  }, [candidates, evaluation, local]);

  const criterionCompletion = useMemo(() => {
    if (!candidates || !evaluation) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const cr of evaluation.criteria) {
      let count = 0;
      for (const c of candidates) {
        if (local.get(scoreKey(c._id, cr._id)) !== undefined) count += 1;
      }
      map.set(cr._id, count);
    }
    return map;
  }, [candidates, evaluation, local]);

  const buildScoresPayload = (): {
    candidateId: Id<"candidates">;
    criterionId: Id<"rubricCriteria">;
    score: number;
  }[] => {
    if (!evaluation) return [];
    const out: {
      candidateId: Id<"candidates">;
      criterionId: Id<"rubricCriteria">;
      score: number;
    }[] = [];
    for (const [k, score] of local.entries()) {
      const [candidateIdRaw, criterionIdRaw] = k.split("::");
      if (!candidateIdRaw || !criterionIdRaw) continue;
      out.push({
        candidateId: candidateIdRaw as Id<"candidates">,
        criterionId: criterionIdRaw as Id<"rubricCriteria">,
        score,
      });
    }
    return out;
  };

  const onSetScore = (
    candidateId: Id<"candidates">,
    criterionId: Id<"rubricCriteria">,
    n: number,
  ) => {
    setLocal((prev) => {
      const next = new Map(prev);
      next.set(scoreKey(candidateId, criterionId), n);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async (
    payload: ReturnType<typeof buildScoresPayload>,
    silent: boolean,
  ): Promise<boolean> => {
    if (payload.length === 0) {
      if (!silent) {
        toast("Nothing to save yet. Pick at least one rubric score first.");
      }
      return false;
    }
    setSaving(true);
    try {
      await saveScores({ electionId: election._id, scores: payload });
      setLastSavedAt(Date.now());
      setDirty(false);
      if (!silent) toast.success("Draft saved");
      return true;
    } catch (err) {
      const m = getConvexErrorMessage(err, "Save failed.");
      toast.error("Save failed", { description: m });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onManualSave = async () => {
    const payload = buildScoresPayload();
    await handleSave(payload, false);
  };

  const onSubmit = async () => {
    if (totals.complete < totals.total) {
      toast.error("Not ready to submit", {
        description: `Score every candidate before submitting (${totals.complete}/${totals.total} complete).`,
      });
      return;
    }
    const confirmed = await dialog.confirm({
      title: "Submit evaluation?",
      description:
        "Your scores will be visible to admins. You can still edit and resubmit until the internal window closes.",
      confirmText: "Submit",
    });
    if (!confirmed) return;
    const payload = buildScoresPayload();
    const ok = await handleSave(payload, true);
    if (!ok) return;
    try {
      await submit({ electionId: election._id });
      toast.success("Evaluation submitted");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Submit failed.");
      toast.error("Submit failed", { description: m });
    }
  };

  const onReopen = async () => {
    const confirmed = await dialog.confirm({
      title: "Re-open evaluation?",
      description:
        "Your evaluation moves back to draft. Submit again before the window closes or your scores will not count toward the final result.",
      confirmText: "Re-open for editing",
    });
    if (!confirmed) return;
    try {
      await unsubmit({ electionId: election._id });
      toast.success("Re-opened for editing");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Could not re-open.");
      toast.error("Re-open failed", { description: m });
    }
  };

  if (!candidates || !evaluation) {
    return <PageSkeleton />;
  }

  if (candidates.length === 0) {
    return (
      <Standby
        cycleName={election.name}
        phase="Awaiting candidates"
        body="Admins haven't added any candidates yet. The rubric activates the moment a candidate slate is published."
      />
    );
  }

  if (evaluation.criteria.length === 0) {
    return (
      <Standby
        cycleName={election.name}
        phase="Awaiting rubric"
        body="Admins haven't set up the rubric criteria for this cycle yet. The scoring grid activates the moment the rubric is published."
      />
    );
  }

  const internalShare = internalSharePercent(getWeights(election));
  const publicShare = Math.max(0, 100 - internalShare);

  const orderedCandidates = candidates.slice().sort((a, b) => {
    return a.fullName.localeCompare(b.fullName, "en");
  });

  const activeCriterion =
    evaluation.criteria[
      Math.min(activeCriterionIdx, evaluation.criteria.length - 1)
    ];

  const goPrev = () => {
    setActiveCriterionIdx((i) => Math.max(0, i - 1));
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goNext = () => {
    setActiveCriterionIdx((i) =>
      Math.min(evaluation.criteria.length - 1, i + 1),
    );
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goReview = () => {
    setView("review");
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBackToScore = (criterionIdx?: number) => {
    if (criterionIdx !== undefined) setActiveCriterionIdx(criterionIdx);
    setView("score");
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="container-wide space-y-10 py-12 pb-32">
      <header className="space-y-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <SectionMarker
              primary="Internal evaluation"
              secondary={election.name}
            />
            <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
              Score the candidates
            </h1>
            <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Score every active candidate against each rubric criterion, one
              criterion at a time. Drafts save explicitly. Your scores are
              private until you submit, and remain editable until the internal
              window closes.
            </p>
          </div>
          <StatusStrip
            isSubmitted={Boolean(isSubmitted)}
            complete={totals.complete}
            total={totals.total}
            lastSavedAt={lastSavedAt}
          />
        </div>

        {voterClass ? (
          <MetaGroup className="sm:grid-cols-3">
            <Meta label="Evaluating as" value={VOTER_CLASS_LABEL[voterClass]} />
            <Meta
              label="Class weight"
              value={`${voterClassWeight}% of final`}
            />
            <Meta
              label="Final result split"
              value={`${internalShare}% internal / ${publicShare}% public`}
            />
          </MetaGroup>
        ) : null}
      </header>

      <RubricHelp />

      {view === "score" && activeCriterion ? (
        <ScoreView
          criterion={activeCriterion}
          activeIdx={activeCriterionIdx}
          allCriteria={evaluation.criteria}
          candidates={orderedCandidates}
          local={local}
          editable={editable}
          criterionCompletion={criterionCompletion}
          totals={totals}
          onSetScore={onSetScore}
          onPickCriterion={(i) => {
            setActiveCriterionIdx(i);
            if (typeof window !== "undefined")
              window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onPrev={goPrev}
          onNext={goNext}
          onReview={goReview}
        />
      ) : null}

      {view === "review" ? (
        <ReviewView
          candidates={orderedCandidates}
          allCriteria={evaluation.criteria}
          local={local}
          totals={totals}
          onJumpToCriterion={(i) => goBackToScore(i)}
          onBack={() => goBackToScore()}
        />
      ) : null}

      <StickyControls
        dirty={dirty}
        saving={saving}
        isSubmitted={Boolean(isSubmitted)}
        lastSavedAt={lastSavedAt}
        completeRatio={`${totals.complete}/${totals.total}`}
        onSave={onManualSave}
        onSubmit={onSubmit}
        onReopen={onReopen}
      />
    </main>
  );
}

function StatusStrip({
  isSubmitted,
  complete,
  total,
  lastSavedAt,
}: {
  isSubmitted: boolean;
  complete: number;
  total: number;
  lastSavedAt: number | null;
}) {
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Badge tone={isSubmitted ? "success" : "brand"}>
        {isSubmitted ? (
          <>
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Submitted
          </>
        ) : (
          <>
            <Pencil className="h-3 w-3" aria-hidden /> Draft
          </>
        )}
      </Badge>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
        {complete} / {total} candidates fully scored
      </p>
      {lastSavedAt ? (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Last saved {formatRelative(lastSavedAt)}
        </p>
      ) : null}
    </div>
  );
}

function ScoreView({
  criterion,
  activeIdx,
  allCriteria,
  candidates,
  local,
  editable,
  criterionCompletion,
  totals,
  onSetScore,
  onPickCriterion,
  onPrev,
  onNext,
  onReview,
}: {
  criterion: { _id: Id<"rubricCriteria">; name: string; maxScore: number };
  activeIdx: number;
  allCriteria: { _id: Id<"rubricCriteria">; name: string; maxScore: number }[];
  candidates: CandidateRow[];
  local: ScoreMap;
  editable: boolean;
  criterionCompletion: Map<string, number>;
  totals: { complete: number; total: number; criteriaCount: number };
  onSetScore: (
    candidateId: Id<"candidates">,
    criterionId: Id<"rubricCriteria">,
    n: number,
  ) => void;
  onPickCriterion: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onReview: () => void;
}) {
  const category = matchRubricCategory(criterion.name);
  const isFirst = activeIdx === 0;
  const isLast = activeIdx === allCriteria.length - 1;
  const prev = !isFirst ? allCriteria[activeIdx - 1] : null;
  const next = !isLast ? allCriteria[activeIdx + 1] : null;
  const scoredHere = criterionCompletion.get(criterion._id) ?? 0;
  const totalCandidates = candidates.length;

  return (
    <section
      aria-label="Score one criterion at a time"
      className="space-y-8"
      key={criterion._id}
    >
      <CriterionStepper
        criteria={allCriteria}
        activeIdx={activeIdx}
        criterionCompletion={criterionCompletion}
        totalCandidates={totalCandidates}
        onPick={onPickCriterion}
      />

      <div className="space-y-4">
        <SectionMarker
          primary={`Criterion ${String(activeIdx + 1).padStart(2, "0")} of ${String(
            allCriteria.length,
          ).padStart(2, "0")}`}
          secondary={`Max ${criterion.maxScore} per candidate`}
        />
        <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.012em] text-[var(--ink)] sm:text-3xl">
          {criterion.name}
        </h2>
        {category ? (
          <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {category.bullets.join(" · ")}
          </p>
        ) : null}
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] tabular-nums text-[var(--ink-muted)]">
          {scoredHere} / {totalCandidates} candidates scored on this criterion
        </div>
      </div>

      <ol
        aria-label={`${criterion.name} scores`}
        className="divide-y divide-[var(--ink-line)] border-y border-[var(--ink-line)]"
      >
        {candidates.map((c, idx) => {
          const value = local.get(scoreKey(c._id, criterion._id));
          const allFilled = allCriteria.every(
            (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
          );
          return (
            <li
              key={c._id}
              className="tile-enter"
              style={{ ["--index" as never]: idx }}
            >
              <CandidateScoreRow
                candidate={c}
                value={value}
                maxScore={criterion.maxScore}
                index={idx}
                allFilled={allFilled}
                disabled={!editable}
                onChange={(n) => onSetScore(c._id, criterion._id, n)}
                ariaLabel={`${c.fullName}, ${criterion.name}`}
              />
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={onPrev}
          disabled={isFirst}
          aria-label={
            prev
              ? `Previous criterion: ${prev.name}`
              : "Previous criterion (disabled)"
          }
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {prev ? (
            <span className="flex flex-col items-start text-left leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Previous
              </span>
              <span>{prev.name}</span>
            </span>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        {isLast ? (
          <Button
            onClick={onReview}
            aria-label={`Review all ${totals.total} candidates before submitting`}
          >
            <span className="flex flex-col items-end text-right leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">
                Final step
              </span>
              <span>Review and submit</span>
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button
            onClick={onNext}
            aria-label={next ? `Next criterion: ${next.name}` : "Next criterion"}
          >
            <span className="flex flex-col items-end text-right leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">
                Next criterion
              </span>
              <span>{next?.name ?? "Next"}</span>
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </section>
  );
}

function CriterionStepper({
  criteria,
  activeIdx,
  criterionCompletion,
  totalCandidates,
  onPick,
}: {
  criteria: { _id: Id<"rubricCriteria">; name: string }[];
  activeIdx: number;
  criterionCompletion: Map<string, number>;
  totalCandidates: number;
  onPick: (i: number) => void;
}) {
  return (
    <ol
      aria-label="Rubric criteria"
      className="flex flex-wrap items-stretch gap-2"
    >
      {criteria.map((cr, idx) => {
        const completed = criterionCompletion.get(cr._id) ?? 0;
        const allDone = totalCandidates > 0 && completed >= totalCandidates;
        const active = idx === activeIdx;
        return (
          <li key={cr._id} className="min-w-[10rem] flex-1">
            <button
              type="button"
              onClick={() => onPick(idx)}
              aria-current={active ? "step" : undefined}
              aria-label={`Go to criterion ${idx + 1}: ${cr.name}. ${completed} of ${totalCandidates} candidates scored.`}
              className={cn(
                "group flex w-full items-baseline gap-2.5 border-t-2 py-3 pr-2 pl-2 text-left",
                "transition-[border-color,background-color,color] duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                active
                  ? "border-[var(--ink)] bg-[var(--paper-2)]/40"
                  : allDone
                    ? "border-[var(--color-success)] hover:bg-[var(--paper-2)]/30"
                    : "border-[var(--ink-line)] hover:border-[var(--ink)]/50 hover:bg-[var(--paper-2)]/20",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] tabular-nums",
                  active
                    ? "text-[var(--ink)]"
                    : allDone
                      ? "text-[var(--color-success)]"
                      : "text-[var(--ink-muted)]",
                )}
                aria-hidden
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate font-medium",
                    active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
                  )}
                >
                  {cr.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                  {completed} / {totalCandidates}
                </span>
              </span>
              {allDone ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="h-3.5 w-3.5 shrink-0 text-[var(--ink-line)]"
                  aria-hidden
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CandidateScoreRow({
  candidate,
  value,
  maxScore,
  index,
  allFilled,
  disabled,
  onChange,
  ariaLabel,
}: {
  candidate: CandidateRow;
  value: number | undefined;
  maxScore: number;
  index: number;
  allFilled: boolean;
  disabled: boolean;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  const positionLabel = candidate.positions
    .slice()
    .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
    .map((p) => p.name)
    .join(", ");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
      <span
        className="font-mono text-lg font-medium tabular-nums text-[var(--ink-muted)] sm:text-xl"
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--color-muted)]">
        {candidate.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[var(--paper-2)]" />
        )}
      </div>
      <div className="min-w-0 flex-1 basis-[16rem]">
        <div className="truncate font-medium text-[var(--ink)]">
          {candidate.fullName}
        </div>
        <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums">
          {candidate.matric && !candidate.matric.startsWith("auto-") ? (
            <span>{candidate.matric}</span>
          ) : null}
          {candidate.matric &&
          !candidate.matric.startsWith("auto-") &&
          positionLabel ? (
            <span aria-hidden className="px-1 text-[var(--copper)]">
              ·
            </span>
          ) : null}
          {positionLabel ? <span>{positionLabel}</span> : null}
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {maxScore <= 5 ? (
          <ScoreButtons
            value={value}
            maxScore={maxScore}
            onChange={onChange}
            ariaLabel={ariaLabel}
            disabled={disabled}
          />
        ) : (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxScore}
            step={1}
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              const clamped = Math.max(1, Math.min(maxScore, Math.round(n)));
              onChange(clamped);
            }}
            aria-label={ariaLabel}
            className="h-9 w-20 rounded-md border bg-[var(--color-background)] px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          />
        )}
        {allFilled ? (
          <Badge tone="muted" className="text-[10px]">
            <Check
              className="h-3 w-3 text-[var(--color-success)]"
              aria-hidden
            />
            Complete
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function ReviewView({
  candidates,
  allCriteria,
  local,
  totals,
  onJumpToCriterion,
  onBack,
}: {
  candidates: CandidateRow[];
  allCriteria: { _id: Id<"rubricCriteria">; name: string; maxScore: number }[];
  local: ScoreMap;
  totals: { complete: number; total: number; criteriaCount: number };
  onJumpToCriterion: (i: number) => void;
  onBack: () => void;
}) {
  const incomplete = totals.total - totals.complete;
  return (
    <section
      aria-label="Review your scores before submitting"
      className="space-y-6"
    >
      <header className="space-y-3">
        <SectionMarker
          primary="Review"
          secondary="Verify before submitting"
        />
        <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.012em] text-[var(--ink)] sm:text-3xl">
          Confirm every score
        </h2>
        <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Click any column header to jump back to that criterion. Rows
          highlighted in copper are missing at least one score; resolve them
          before submitting.
        </p>
        {incomplete > 0 ? (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--copper)]">
            {incomplete} candidate{incomplete === 1 ? "" : "s"} still need
            scoring
          </p>
        ) : (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--color-success)]">
            All {totals.total} candidates fully scored
          </p>
        )}
      </header>

      <div className="overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
              <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                Candidate
              </th>
              {allCriteria.map((cr, idx) => (
                <th
                  key={cr._id}
                  className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)] whitespace-nowrap"
                >
                  <button
                    type="button"
                    onClick={() => onJumpToCriterion(idx)}
                    className="cursor-pointer underline-offset-4 hover:text-[var(--ink)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                    aria-label={`Jump to ${cr.name} scoring`}
                  >
                    {cr.name}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const allFilled = allCriteria.every(
                (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
              );
              const total = allCriteria.reduce((sum, cr) => {
                return sum + (local.get(scoreKey(c._id, cr._id)) ?? 0);
              }, 0);
              return (
                <tr
                  key={c._id}
                  className={cn(
                    "border-b border-[var(--ink-line)] last:border-b-0",
                    !allFilled ? "bg-[var(--copper)]/8" : null,
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--ink)]">
                      {c.fullName}
                    </div>
                    {c.matric && !c.matric.startsWith("auto-") ? (
                      <div className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                        {c.matric}
                      </div>
                    ) : null}
                  </td>
                  {allCriteria.map((cr, idx) => {
                    const value = local.get(scoreKey(c._id, cr._id));
                    return (
                      <td
                        key={cr._id}
                        className="px-3 py-2 text-right font-mono tabular-nums"
                      >
                        {value === undefined ? (
                          <button
                            type="button"
                            onClick={() => onJumpToCriterion(idx)}
                            className="text-[var(--copper)] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                            aria-label={`Score ${c.fullName} on ${cr.name}`}
                          >
                            —
                          </button>
                        ) : (
                          <span className="text-[var(--ink)]">{value}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-[var(--ink)]">
                    {total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to scoring
      </Button>
    </section>
  );
}

function StickyControls({
  dirty,
  saving,
  isSubmitted,
  lastSavedAt,
  completeRatio,
  onSave,
  onSubmit,
  onReopen,
}: {
  dirty: boolean;
  saving: boolean;
  isSubmitted: boolean;
  lastSavedAt: number | null;
  completeRatio: string;
  onSave: () => void;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  return (
    <div
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--ink-line)] bg-[var(--paper)]/95 px-4 py-3 shadow-[0_-12px_40px_-8px_rgba(15,106,106,0.18)] backdrop-blur"
      role="region"
      aria-label="Save and submit"
    >
      <span
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
        aria-live="polite"
      >
        {dirty
          ? "Unsaved changes"
          : lastSavedAt
            ? `Saved ${formatRelative(lastSavedAt)}`
            : "No scores saved yet"}
      </span>
      <div className="flex-1" />
      {isSubmitted ? (
        <Button variant="outline" onClick={onReopen}>
          Re-open for editing
        </Button>
      ) : (
        <>
          <Button variant="outline" onClick={onSave} loading={saving}>
            <Save className="h-4 w-4" aria-hidden /> Save draft
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            <Pencil className="h-4 w-4" aria-hidden /> Submit ({completeRatio})
          </Button>
        </>
      )}
    </div>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return formatMYT(ms);
}
