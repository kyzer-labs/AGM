"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Pencil,
  Save,
  ShieldOff,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { useDialog } from "@/components/dialog/dialog-provider";
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
import { RubricHelp } from "@/components/internal/rubric-help";
import { ScoreButtons } from "@/components/internal/score-buttons";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type RubricCategory =
  | "leadership"
  | "teamwork"
  | "professionalism"
  | "commitment"
  | "personality";

const CATEGORIES: { key: RubricCategory; label: string }[] = [
  { key: "leadership", label: "Leadership" },
  { key: "teamwork", label: "Teamwork & Communication" },
  { key: "professionalism", label: "Professionalism & Ethics" },
  { key: "commitment", label: "Commitment" },
  { key: "personality", label: "Personality" },
];

type ScoreRow = Partial<Record<RubricCategory, number>>;

export default function InternalPage() {
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
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  if (election === null)
    return (
      <main className="container-narrow py-12">
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
          title="No active election"
          description="Internal evaluation will appear here once admins create the AGM cycle and open the window."
        />
      </main>
    );
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const status = useQuery(api.internal.myStatus, {
    electionId: election._id,
  });

  if (status === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!status.isWhitelisted) {
    return (
      <main className="container-narrow py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5" aria-hidden />
                Not on the internal whitelist
              </CardTitle>
              <Badge tone="muted">External voter</Badge>
            </div>
            <CardDescription>
              Internal evaluation is restricted to Year 2 committee members
              on the whitelist for <strong>{election.name}</strong>. You will
              vote externally during the live AGM. If you believe this is a
              mistake, contact the AGM admin team.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (election.phase === "setup") {
    return (
      <PhaseInfo
        title="Internal evaluation hasn't opened yet"
        body={`Admins are still preparing "${election.name}". Check back when the internal evaluation window opens — typically about a week before AGM day.`}
        icon={<Clock className="h-5 w-5" aria-hidden />}
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
      <PhaseInfo
        title="Internal evaluation is closed"
        body={
          status.evaluationStatus === "submitted"
            ? `Your evaluation was submitted on ${formatDate(status.submittedAt)}. Scores can no longer be edited.`
            : "The internal window is closed. New scores can no longer be saved."
        }
        icon={<Lock className="h-5 w-5" aria-hidden />}
      />
    );
  }

  return <ActiveEvaluation election={election} />;
}

function PhaseInfo({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <main className="container-narrow py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

function ActiveEvaluation({ election }: { election: Doc<"elections"> }) {
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

  const [local, setLocal] = useState<Map<Id<"candidates">, ScoreRow>>(
    new Map(),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!evaluation) return;
    const key = `${evaluation.evaluationId ?? "new"}-${evaluation.scores.length}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    const next = new Map<Id<"candidates">, ScoreRow>();
    for (const s of evaluation.scores) {
      next.set(s.candidateId, {
        leadership: s.leadership,
        teamwork: s.teamwork,
        professionalism: s.professionalism,
        commitment: s.commitment,
        personality: s.personality,
      });
    }
    setLocal(next);
    setDirty(false);
    if (evaluation.submittedAt) setLastSavedAt(evaluation.submittedAt);
  }, [evaluation]);

  const isSubmitted = evaluation?.status === "submitted";
  const editable = !isSubmitted;

  const totals = useMemo(() => {
    if (!candidates) return { complete: 0, total: 0 };
    let complete = 0;
    for (const c of candidates) {
      const row = local.get(c._id);
      if (
        row &&
        row.leadership !== undefined &&
        row.teamwork !== undefined &&
        row.professionalism !== undefined &&
        row.commitment !== undefined &&
        row.personality !== undefined
      )
        complete += 1;
    }
    return { complete, total: candidates.length };
  }, [candidates, local]);

  const buildScoresPayload = (): {
    candidateId: Id<"candidates">;
    leadership: number;
    teamwork: number;
    professionalism: number;
    commitment: number;
    personality: number;
  }[] => {
    const out: ReturnType<typeof buildScoresPayload> = [];
    for (const [candidateId, row] of local.entries()) {
      if (
        row.leadership === undefined ||
        row.teamwork === undefined ||
        row.professionalism === undefined ||
        row.commitment === undefined ||
        row.personality === undefined
      )
        continue;
      out.push({
        candidateId,
        leadership: row.leadership,
        teamwork: row.teamwork,
        professionalism: row.professionalism,
        commitment: row.commitment,
        personality: row.personality,
      });
    }
    return out;
  };

  const onSetScore = (
    candidateId: Id<"candidates">,
    cat: RubricCategory,
    n: number,
  ) => {
    setLocal((prev) => {
      const next = new Map(prev);
      const current = next.get(candidateId) ?? {};
      next.set(candidateId, { ...current, [cat]: n });
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
        toast("Nothing to save yet — pick at least one full row first.");
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
      const m = err instanceof Error ? err.message : "Save failed.";
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
        description: `Score every candidate (${totals.complete}/${totals.total} complete).`,
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
      toast.success("Submitted!");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Submit failed.";
      toast.error("Submit failed", { description: m });
    }
  };

  const onReopen = async () => {
    const confirmed = await dialog.confirm({
      title: "Re-open evaluation?",
      description:
        "Your evaluation will move back to draft status. Submit again before the window closes or your scores will not count.",
      confirmText: "Re-open for editing",
    });
    if (!confirmed) return;
    try {
      await unsubmit({ electionId: election._id });
      toast.success("Re-opened for editing");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Could not re-open.";
      toast.error("Re-open failed", { description: m });
    }
  };

  if (!candidates) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (candidates.length === 0) {
    return (
      <main className="container-narrow py-12">
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
          title="No candidates to evaluate"
          description="Admins haven't added any candidates yet."
        />
      </main>
    );
  }

  return (
    <main className="container-wide py-10 space-y-6">
      <header className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Internal evaluation
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Score every active candidate against each rubric category from{" "}
            <strong>1 (Unsatisfactory)</strong> to{" "}
            <strong>5 (Excellent)</strong>. Drafts save explicitly — your
            scores are private until you submit.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
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
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {totals.complete} / {totals.total} candidates fully scored
          </span>
          {lastSavedAt ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Last saved {formatRelative(lastSavedAt)}
            </span>
          ) : null}
        </div>
      </header>

      <RubricHelp />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                  <th className="sticky left-0 z-10 min-w-[14rem] bg-[var(--color-muted)]/40 px-3 py-2 font-medium">
                    Candidate
                  </th>
                  {CATEGORIES.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const row = local.get(c._id) ?? {};
                  const allFilled = CATEGORIES.every(
                    (cat) => row[cat.key] !== undefined,
                  );
                  return (
                    <tr key={c._id} className="border-b last:border-b-0">
                      <td className="sticky left-0 z-10 min-w-[14rem] bg-[var(--color-card)] px-3 py-3">
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
                              {c.matric}
                              {c.positions.length > 0 ? (
                                <>
                                  {" "}
                                  ·{" "}
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
                              <Badge tone="success" className="mt-1 text-[10px]">
                                Complete
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      {CATEGORIES.map((cat) => (
                        <td key={cat.key} className="px-3 py-3 align-middle">
                          <ScoreButtons
                            value={row[cat.key]}
                            onChange={(n) => onSetScore(c._id, cat.key, n)}
                            ariaLabel={`${c.fullName} ${cat.label}`}
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

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-[var(--color-card)]/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-sm text-[var(--color-muted-foreground)]">
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
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              Submit ({totals.complete}/{totals.total})
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return formatDate(ms);
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}
