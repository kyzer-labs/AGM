"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Save } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreButtons } from "@/components/internal/score-buttons";
import { RubricHelp } from "@/components/internal/rubric-help";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { getWeights, internalSharePercent } from "@/lib/weights";

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
    <main className="container-narrow py-20 sm:py-24">
      <header className="space-y-4">
        <SectionMarker primary="Internal evaluation" secondary={phase} />
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {cycleName ?? "No active AGM cycle"}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {body}
        </p>
      </header>
    </main>
  );
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

  return (
    <main className="container-wide space-y-10 py-12">
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
              Score every active candidate against each rubric criterion.
              Drafts save explicitly. Your scores are private until you
              submit, and remain editable until the internal window closes.
            </p>
          </div>
          <StatusStrip
            isSubmitted={isSubmitted}
            complete={totals.complete}
            total={totals.total}
            lastSavedAt={lastSavedAt}
          />
        </div>

        {voterClass ? (
          <dl className="grid gap-6 border-t border-[var(--ink-line)] pt-6 sm:grid-cols-3">
            <Meta label="Evaluating as" value={VOTER_CLASS_LABEL[voterClass]} />
            <Meta
              label="Class weight"
              value={`${voterClassWeight}% of final`}
            />
            <Meta
              label="Final result split"
              value={`${internalShare}% internal / ${publicShare}% public`}
            />
          </dl>
        ) : null}
      </header>

      <RubricHelp />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Rubric scores for {election.name}. Pick one score per
                criterion for each candidate.
              </caption>
              <thead>
                <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[14rem] bg-[var(--color-muted)]/40 px-3 py-2 font-medium"
                  >
                    Candidate
                  </th>
                  {evaluation.criteria.map((c) => (
                    <th
                      key={c._id}
                      scope="col"
                      className="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      <div>{c.name}</div>
                      <div className="font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                        Max {c.maxScore}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const allFilled = evaluation.criteria.every(
                    (cr) => local.get(scoreKey(c._id, cr._id)) !== undefined,
                  );
                  return (
                    <tr key={c._id} className="border-b last:border-b-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 min-w-[14rem] bg-[var(--color-card)] px-3 py-3 text-left font-normal"
                      >
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.photoUrl}
                              alt=""
                              className="h-9 w-9 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-[var(--color-muted)]" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {c.fullName}
                            </div>
                            <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                              {c.matric && !c.matric.startsWith("auto-") ? (
                                <>{c.matric}</>
                              ) : null}
                              {c.matric &&
                              !c.matric.startsWith("auto-") &&
                              c.positions.length > 0
                                ? " · "
                                : null}
                              {c.positions.length > 0 ? (
                                <>
                                  {c.positions
                                    .slice()
                                    .sort(
                                      (a, b) =>
                                        a.fallbackOrder - b.fallbackOrder,
                                    )
                                    .map((p) => p.name)
                                    .join(", ")}
                                </>
                              ) : null}
                            </div>
                            {allFilled ? (
                              <Badge tone="muted" className="mt-1.5 text-[10px]">
                                <CheckCircle2
                                  className="h-3 w-3 text-[var(--color-success)]"
                                  aria-hidden
                                />{" "}
                                Complete
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </th>
                      {evaluation.criteria.map((cr) => (
                        <td key={cr._id} className="px-3 py-3 align-middle">
                          <CriterionScoreInput
                            value={local.get(scoreKey(c._id, cr._id))}
                            maxScore={cr.maxScore}
                            onChange={(n) => onSetScore(c._id, cr._id, n)}
                            ariaLabel={`${c.fullName}, ${cr.name}`}
                            disabled={!editable}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div
        className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-[var(--color-card)]/95 px-4 py-3 shadow-lg backdrop-blur"
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
            <Button variant="outline" onClick={onManualSave} loading={saving}>
              <Save className="h-4 w-4" aria-hidden /> Save draft
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              <Pencil className="h-4 w-4" aria-hidden /> Submit ({totals.complete}/
              {totals.total})
            </Button>
          </>
        )}
      </div>
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)]">
        {label}
      </dt>
      <dd className="font-mono text-sm text-[var(--ink)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function CriterionScoreInput({
  value,
  maxScore,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number | undefined;
  maxScore: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  disabled: boolean;
}) {
  if (maxScore <= 5) {
    return (
      <ScoreButtons
        value={value}
        maxScore={maxScore}
        onChange={onChange}
        ariaLabel={ariaLabel}
        disabled={disabled}
      />
    );
  }
  return (
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
      className="h-8 w-16 rounded-md border bg-[var(--color-background)] px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return formatMYT(ms);
}
