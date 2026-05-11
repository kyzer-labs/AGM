"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Standby as StandbyBlock } from "@/components/ui/standby";
import { matchRubricCategory } from "@/lib/rubric-categories";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
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
    />
  );
}

function PageSkeleton() {
  return (
    <main className="container-workbench space-y-6 py-12">
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

interface CriterionRow {
  _id: Id<"rubricCriteria">;
  name: string;
  maxScore: number;
}

function ActiveEvaluation({
  election,
  voterClass,
}: {
  election: Doc<"elections">;
  voterClass: VoterClass | null;
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
  const [activeCandidateIdx, setActiveCandidateIdx] = useState(0);
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

  const orderedCandidates = useMemo<CandidateRow[]>(() => {
    if (!candidates) return [];
    return candidates
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "en"));
  }, [candidates]);

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

  // Stable-ref keyboard model. Listener attaches once per ActiveEvaluation
  // mount; reads live state from a ref so we don't re-bind every keystroke.
  // Contract:
  //   1-9: set the active criterion's score (range-checked against maxScore),
  //        then advance to next criterion within the same candidate.
  //   ↑ / ↓: cycle criteria within the active candidate.
  //   ← / →: cycle candidates (resets criterion to 0).
  //   Enter: advance to next candidate when every criterion of the current
  //          candidate has a score; otherwise no-op.
  // Keystrokes are ignored while focus is in an input/textarea/select or any
  // editable element so users can still type freely if a future field lands.
  const kbdRef = useRef<{
    candIdx: number;
    critIdx: number;
    candidates: CandidateRow[];
    criteria: CriterionRow[];
    local: ScoreMap;
    editable: boolean;
    view: View;
  }>({
    candIdx: 0,
    critIdx: 0,
    candidates: [],
    criteria: [],
    local: new Map(),
    editable: false,
    view: "score",
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const s = kbdRef.current;
      if (s.view !== "score" || !s.editable) return;
      const cand = s.candidates[s.candIdx];
      const cr = s.criteria[s.critIdx];
      if (!cand || !cr) return;
      const k = e.key;
      if (k >= "1" && k <= "9" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const n = Number(k);
        if (n < 1 || n > cr.maxScore) return;
        e.preventDefault();
        onSetScore(cand._id, cr._id, n);
        if (s.critIdx < s.criteria.length - 1) {
          setActiveCriterionIdx(s.critIdx + 1);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === "ArrowDown") {
        e.preventDefault();
        setActiveCriterionIdx((i) => Math.min(s.criteria.length - 1, i + 1));
      } else if (k === "ArrowUp") {
        e.preventDefault();
        setActiveCriterionIdx((i) => Math.max(0, i - 1));
      } else if (k === "ArrowRight") {
        e.preventDefault();
        setActiveCandidateIdx((i) => Math.min(s.candidates.length - 1, i + 1));
        setActiveCriterionIdx(0);
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        setActiveCandidateIdx((i) => Math.max(0, i - 1));
        setActiveCriterionIdx(0);
      } else if (k === "Enter") {
        const allScored = s.criteria.every(
          (c) => s.local.get(scoreKey(cand._id, c._id)) !== undefined,
        );
        if (allScored && s.candIdx < s.candidates.length - 1) {
          e.preventDefault();
          setActiveCandidateIdx(s.candIdx + 1);
          setActiveCriterionIdx(0);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const totalCount = orderedCandidates.length;
  const criteriaCount = evaluation.criteria.length;
  const safeCandIdx = Math.max(0, Math.min(activeCandidateIdx, totalCount - 1));
  const safeCritIdx = Math.max(
    0,
    Math.min(activeCriterionIdx, criteriaCount - 1),
  );
  const activeCand: CandidateRow | undefined = orderedCandidates[safeCandIdx];

  const perCandidateFilled = (c: CandidateRow): number =>
    evaluation.criteria.filter(
      (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
    ).length;

  const activeAllScored =
    activeCand !== undefined &&
    evaluation.criteria.every(
      (cr) => local.get(scoreKey(activeCand._id, cr._id)) !== undefined,
    );

  // Keep keyboard ref in sync each render.
  kbdRef.current = {
    candIdx: safeCandIdx,
    critIdx: safeCritIdx,
    candidates: orderedCandidates,
    criteria: evaluation.criteria,
    local,
    editable,
    view,
  };

  const goPrevCandidate = () => {
    setActiveCandidateIdx((i) => Math.max(0, i - 1));
    setActiveCriterionIdx(0);
  };
  const goNextCandidate = () => {
    setActiveCandidateIdx((i) => Math.min(totalCount - 1, i + 1));
    setActiveCriterionIdx(0);
  };
  const pickCandidate = (i: number) => {
    setActiveCandidateIdx(i);
    setActiveCriterionIdx(0);
  };
  const goReview = () => {
    setView("review");
  };
  const goBackToScore = (candidateIdx?: number, criterionIdx?: number) => {
    if (candidateIdx !== undefined) setActiveCandidateIdx(candidateIdx);
    if (criterionIdx !== undefined) setActiveCriterionIdx(criterionIdx);
    setView("score");
  };

  const renderRail = (railClassName = "") => (
    <nav
      className={cn("internal-rail", railClassName)}
      aria-label="Candidate roster"
    >
      <p className="internal-rail-h">Roster · {totalCount}</p>
      <ol className="internal-rail-list">
        {orderedCandidates.map((c, i) => {
          const filled = perCandidateFilled(c);
          const allDone = filled === criteriaCount;
          const isActive = i === safeCandIdx;
          return (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => pickCandidate(i)}
                className={cn("internal-rail-item", isActive && "is-active")}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${c.fullName}, ${filled} of ${criteriaCount} criteria scored`}
              >
                <span className="internal-rail-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="internal-rail-name">{c.fullName}</span>
                <span
                  className={cn("internal-rail-prog", allDone && "is-done")}
                >
                  {filled}/{criteriaCount}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const renderSurface = (surfaceClassName = "") => (
    <main className={cn("container-workbench", surfaceClassName)}>
      {view === "score" ? (
        <>
          <div className="internal-strip internal-strip-distill-v1">
            <div>
              <p className="internal-strip-mark">
                Internal evaluation{" "}
                <span className="internal-dot" aria-hidden>
                  ·
                </span>{" "}
                {election.name}
              </p>
              <h1 className="internal-strip-title">Score the candidates</h1>
              <p className="internal-strip-meta">
                {voterClass ? VOTER_CLASS_LABEL[voterClass] : "Evaluator"}
              </p>
            </div>
            <div className="internal-strip-status">
              <span className="internal-draft" aria-live="polite">
                {isSubmitted ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Submitted
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" aria-hidden />
                    Draft
                  </>
                )}
              </span>
              <span className="internal-progress">
                {totals.complete} / {totals.total} complete
              </span>
            </div>
          </div>

          <div className="internal-body">
            {renderRail("internal-rail-lock-v1")}

            <article
              className="internal-card"
              aria-label="Active candidate scoring"
              key={activeCand?._id ?? "none"}
            >
              <div className="internal-card-head">
                <div className="internal-photo" aria-hidden>
                  {activeCand?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeCand.photoUrl} alt="" />
                  ) : null}
                </div>
                <div>
                  <p className="internal-bio-step">
                    Candidate {String(safeCandIdx + 1).padStart(2, "0")} of{" "}
                    {String(totalCount).padStart(2, "0")}
                  </p>
                  <h2 className="internal-bio-name">
                    {activeCand?.fullName ?? "—"}
                  </h2>
                  <p className="internal-bio-pos">
                    {activeCand?.matric &&
                    !activeCand.matric.startsWith("auto-") ? (
                      <>
                        <span>{activeCand.matric}</span>
                        {activeCand.positions[0] ? (
                          <span className="internal-dot" aria-hidden>
                            ·
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {activeCand?.positions
                      .slice()
                      .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
                      .map((p) => p.name)
                      .join(", ") || null}
                  </p>
                </div>
                <div className="internal-keys" aria-hidden>
                  <div className="internal-keys-row">
                    <kbd>1</kbd>
                    <kbd>2</kbd>
                    <kbd>3</kbd>
                    <kbd>4</kbd>
                    <kbd>5</kbd>
                    <span>score</span>
                  </div>
                  <div className="internal-keys-row">
                    <kbd>↑</kbd>
                    <kbd>↓</kbd>
                    <span>criterion</span>
                  </div>
                  <div className="internal-keys-row">
                    <kbd>←</kbd>
                    <kbd>→</kbd>
                    <span>candidate</span>
                  </div>
                </div>
              </div>

              <ol className="internal-criteria">
                {evaluation.criteria.map((cr, i) => {
                  const value = activeCand
                    ? local.get(scoreKey(activeCand._id, cr._id))
                    : undefined;
                  const blurb =
                    matchRubricCategory(cr.name)?.bullets.join(" · ") ?? null;
                  const isFocus = i === safeCritIdx;
                  return (
                    <li
                      key={cr._id}
                      className={cn(
                        "internal-crit",
                        isFocus && "is-active",
                      )}
                    >
                      <div className="internal-crit-mark">
                        <span className="internal-crit-num">
                          Criterion {String(i + 1).padStart(2, "0")}
                          <span className="internal-dot" aria-hidden>
                            {" · "}
                          </span>
                          Max {cr.maxScore}
                        </span>
                        <span className="internal-crit-name">{cr.name}</span>
                      </div>
                      <p className="internal-crit-rubric">
                        {blurb ?? "Apply the rubric reference."}
                      </p>
                      <div
                        className="internal-buttons"
                        role="group"
                        aria-label={`${cr.name} score for ${activeCand?.fullName ?? "candidate"}`}
                      >
                        {Array.from(
                          { length: cr.maxScore },
                          (_, n) => n + 1,
                        ).map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={!editable || !activeCand}
                            onClick={() =>
                              activeCand &&
                              onSetScore(activeCand._id, cr._id, n)
                            }
                            onFocus={() => setActiveCriterionIdx(i)}
                            aria-pressed={value === n}
                            aria-label={`${n} of ${cr.maxScore}`}
                            className={cn(
                              "internal-btn",
                              value === n && "is-on",
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <footer className="internal-card-foot">
                <button
                  type="button"
                  className="internal-pager"
                  onClick={goPrevCandidate}
                  disabled={safeCandIdx === 0}
                  aria-label={
                    safeCandIdx === 0
                      ? "Previous candidate (disabled)"
                      : `Previous candidate: ${orderedCandidates[safeCandIdx - 1]?.fullName ?? ""}`
                  }
                >
                  ← Previous
                </button>
                {safeCandIdx === totalCount - 1 ? (
                  <button
                    type="button"
                    className="internal-pager is-primary"
                    onClick={goReview}
                    aria-label={`Review all ${totalCount} candidates before submitting`}
                  >
                    Review and submit →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "internal-pager",
                      activeAllScored && "is-primary",
                    )}
                    onClick={goNextCandidate}
                    aria-label={`Next candidate: ${
                      orderedCandidates[safeCandIdx + 1]?.fullName ?? ""
                    }`}
                  >
                    Next candidate →
                  </button>
                )}
              </footer>
            </article>
          </div>
        </>
      ) : null}

      {view === "review" ? (
        <ReviewView
          candidates={orderedCandidates}
          allCriteria={evaluation.criteria}
          local={local}
          totals={totals}
          onJumpTo={(candidateIdx, criterionIdx) =>
            goBackToScore(candidateIdx, criterionIdx)
          }
          onBack={() => goBackToScore()}
        />
      ) : null}

      <div
        className="internal-save"
        role="region"
        aria-label="Save and submit"
      >
        <span className="internal-save-status" aria-live="polite">
          {dirty
            ? "Unsaved changes"
            : lastSavedAt
              ? `Saved ${formatRelative(lastSavedAt)}`
              : "No scores saved yet"}
        </span>
        {isSubmitted ? (
          <button
            type="button"
            className="internal-pager"
            onClick={onReopen}
          >
            Re-open for editing
          </button>
        ) : (
          <>
            <button
              type="button"
              className="internal-pager"
              onClick={onManualSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="internal-pager is-primary"
              onClick={onSubmit}
              disabled={saving}
            >
              Submit ({totals.complete}/{totals.total})
            </button>
          </>
        )}
      </div>
    </main>
  );

  return renderSurface();
}

function ReviewView({
  candidates,
  allCriteria,
  local,
  totals,
  onJumpTo,
  onBack,
}: {
  candidates: CandidateRow[];
  allCriteria: { _id: Id<"rubricCriteria">; name: string; maxScore: number }[];
  local: ScoreMap;
  totals: { complete: number; total: number; criteriaCount: number };
  onJumpTo: (candidateIdx: number, criterionIdx: number) => void;
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
          Click any cell to jump back to that exact candidate-criterion pair.
          Rows highlighted in copper still need scoring; resolve them before
          submitting.
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
              {allCriteria.map((cr) => (
                <th
                  key={cr._id}
                  className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)] whitespace-nowrap"
                >
                  {cr.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, candIdx) => {
              const total = allCriteria.reduce(
                (sum, cr) =>
                  sum + (local.get(scoreKey(c._id, cr._id)) ?? 0),
                0,
              );
              const allFilled = allCriteria.every(
                (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
              );
              return (
                <tr
                  key={c._id}
                  className={cn(
                    "border-b border-[var(--ink-line)] last:border-b-0",
                    !allFilled &&
                      "bg-[color-mix(in_srgb,var(--copper)_8%,transparent)]",
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
                  {allCriteria.map((cr, critIdx) => {
                    const value = local.get(scoreKey(c._id, cr._id));
                    return (
                      <td
                        key={cr._id}
                        className="px-3 py-2 text-right font-mono tabular-nums"
                      >
                        {value === undefined ? (
                          <button
                            type="button"
                            onClick={() => onJumpTo(candIdx, critIdx)}
                            className="text-[var(--copper)] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                            aria-label={`Score ${c.fullName} on ${cr.name}`}
                          >
                            —
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onJumpTo(candIdx, critIdx)}
                            className="text-[var(--ink)] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                            aria-label={`${c.fullName} ${cr.name}: ${value} of ${cr.maxScore}. Click to revise.`}
                          >
                            {value}
                          </button>
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

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return formatMYT(ms);
}
