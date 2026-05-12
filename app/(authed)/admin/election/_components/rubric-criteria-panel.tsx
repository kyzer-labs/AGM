"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  describeCollectedData,
  type CycleStats,
} from "./weights-panel";

const criterionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(80, "At most 80 characters"),
  maxScore: z.coerce
    .number({ invalid_type_error: "Max score must be a number" })
    .int("Max score must be a whole number")
    .min(1, "Min 1")
    .max(20, "Max 20"),
});
type CriterionFormValues = z.infer<typeof criterionSchema>;

export function RubricCriteriaPanel({
  election,
  stats,
}: {
  election: Doc<"elections">;
  stats: CycleStats | null;
}) {
  const dialog = useDialog();
  const criteria = useQuery(api.rubric.list, { electionId: election._id });
  const add = useMutation(api.rubric.add);
  const renameC = useMutation(api.rubric.rename);
  const setMaxScore = useMutation(api.rubric.setMaxScore);
  const removeC = useMutation(api.rubric.remove);
  const move = useMutation(api.rubric.move);
  const seedDefaults = useMutation(api.rubric.seedDefaults);

  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Doc<"rubricCriteria"> | null>(null);

  const submittedEvaluations = stats?.submittedEvaluations ?? 0;
  const draftEvaluations = stats?.draftEvaluations ?? 0;

  const onSeed = async () => {
    const ok = await dialog.confirm({
      title: "Seed default criteria?",
      description: (
        <>
          Adds the standard 5-criterion rubric (Leadership, Teamwork &amp;
          Communication, Professionalism &amp; Ethics, Commitment,
          Personality) at max score 5 each. Only works when the rubric is
          empty.
        </>
      ),
      confirmText: "Seed defaults",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const count = await seedDefaults({ electionId: election._id });
      toast.success(`Seeded ${count} criteria`);
    } catch (err) {
      toast.error("Seed failed", {
        description: getConvexErrorMessage(err, "Seed failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const onMove = async (
    criterionId: Id<"rubricCriteria">,
    direction: "up" | "down",
  ) => {
    setBusy(true);
    try {
      await move({ criterionId, direction });
    } catch (err) {
      toast.error("Move failed", {
        description: getConvexErrorMessage(err, "Move failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="space-y-4 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-5"
      aria-labelledby={`rubric-heading-${election._id}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <ListChecks
          className="h-4 w-4 text-[var(--ink-muted)]"
          aria-hidden
        />
        <h3
          id={`rubric-heading-${election._id}`}
          className="text-sm font-semibold text-[var(--ink)]"
        >
          Rubric criteria
        </h3>
        <Badge tone="muted">Setup only</Badge>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => setShowAdd(true)}
          disabled={busy}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add criterion
        </Button>
      </header>
      <p className="max-w-[60ch] text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        Internal evaluators score every candidate on every criterion. Each
        criterion has its own max score (1&ndash;20). Once internal
        evaluation opens, the rubric is frozen for the rest of the cycle.
      </p>

      {submittedEvaluations + draftEvaluations > 0 ? (
        <div className="rounded-md border border-[var(--copper)] bg-[var(--paper)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
          <span className="font-mono uppercase tracking-[0.18em] text-[var(--copper)]">
            Heads up:
          </span>{" "}
          {describeCollectedData({
            submittedEvaluations,
            draftEvaluations,
            totalEvaluations: submittedEvaluations + draftEvaluations,
            lastSubmittedAt: stats?.lastSubmittedAt ?? null,
            publicVoteCount: 0,
          })}{" "}
          Adding a new criterion forces evaluators with submitted
          evaluations to re-open and complete it before the window closes.
        </div>
      ) : null}

      {criteria === undefined ? (
        <Skeleton className="h-20 w-full" />
      ) : criteria.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-[var(--ink-line)] p-4 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No criteria yet. Seed the default rubric or add one manually.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSeed}
            disabled={busy}
          >
            <Plus className="h-4 w-4" aria-hidden /> Seed default rubric
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--ink-line)] rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          {criteria.map((c, idx) => (
            <CriterionRow
              key={c._id}
              criterion={c}
              ordinal={idx + 1}
              isFirst={idx === 0}
              isLast={idx === criteria.length - 1}
              busy={busy}
              onMove={(direction) => onMove(c._id, direction)}
              onEdit={() => setEditing(c)}
              onConfirmedRemove={async (impact) => {
                setBusy(true);
                try {
                  await removeC({ criterionId: c._id });
                  if (impact && impact.scoreCount > 0) {
                    toast.success("Criterion removed", {
                      description: `${impact.scoreCount} ${impact.scoreCount === 1 ? "score" : "scores"} (${impact.submittedScoreCount} submitted, ${impact.draftScoreCount} draft) deleted with it.`,
                    });
                  } else {
                    toast.success("Criterion removed");
                  }
                } catch (err) {
                  toast.error("Remove failed", {
                    description: getConvexErrorMessage(err, "Remove failed."),
                  });
                } finally {
                  setBusy(false);
                }
              }}
            />
          ))}
        </ul>
      )}

      <CriterionFormModal
        mode="add"
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={async (values) => {
          await add({
            electionId: election._id,
            name: values.name,
            maxScore: values.maxScore,
          });
          toast.success("Criterion added");
        }}
      />

      <CriterionFormModal
        mode="edit"
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing}
        warning={
          editing && submittedEvaluations + draftEvaluations > 0
            ? `Renaming ${editing.name} will display the new label on every existing draft and submitted score in this cycle. Changing its max score is recorded against the rubric and does not retroactively rescale submitted scores.`
            : undefined
        }
        onSubmit={async (values) => {
          if (!editing) return;
          if (values.name !== editing.name) {
            await renameC({ criterionId: editing._id, name: values.name });
          }
          if (values.maxScore !== editing.maxScore) {
            await setMaxScore({
              criterionId: editing._id,
              maxScore: values.maxScore,
            });
          }
          toast.success("Criterion updated");
        }}
      />
    </section>
  );
}

interface CriterionImpactSummary {
  scoreCount: number;
  submittedScoreCount: number;
  draftScoreCount: number;
}

function CriterionRow({
  criterion,
  ordinal,
  isFirst,
  isLast,
  busy,
  onMove,
  onEdit,
  onConfirmedRemove,
}: {
  criterion: Doc<"rubricCriteria">;
  ordinal: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onConfirmedRemove: (impact: CriterionImpactSummary | null) => Promise<void>;
}) {
  const dialog = useDialog();
  const impact = useQuery(api.rubric.criterionImpact, {
    criterionId: criterion._id,
  });

  const onConfirmRemove = async () => {
    if (impact === undefined) return;

    const description =
      impact && impact.scoreCount > 0 ? (
        <>
          Permanently remove{" "}
          <strong className="font-semibold">{criterion.name}</strong>. This
          deletes{" "}
          <strong className="font-semibold tabular-nums">
            {impact.scoreCount}
          </strong>{" "}
          {impact.scoreCount === 1 ? "score" : "scores"} tied to it (
          <span className="tabular-nums">{impact.submittedScoreCount}</span>{" "}
          from submitted evaluations,{" "}
          <span className="tabular-nums">{impact.draftScoreCount}</span>{" "}
          draft). Submitted evaluations stay submitted but lose this
          criterion. The action cannot be undone.
        </>
      ) : (
        <>
          Permanently remove{" "}
          <strong className="font-semibold">{criterion.name}</strong>. No
          scores reference it yet, so nothing else changes.
        </>
      );

    const ok = await dialog.confirm({
      title: "Remove this criterion?",
      description,
      confirmText: "Remove criterion",
      variant: "destructive",
    });
    if (!ok) return;
    await onConfirmedRemove(
      impact
        ? {
            scoreCount: impact.scoreCount,
            submittedScoreCount: impact.submittedScoreCount,
            draftScoreCount: impact.draftScoreCount,
          }
        : null,
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
      <span
        className="w-6 font-mono text-xs tabular-nums text-[var(--ink-muted)]"
        aria-hidden
      >
        {String(ordinal).padStart(2, "0")}
      </span>
      <span className="flex-1 font-medium text-[var(--ink)]">
        {criterion.name}
      </span>
      <Badge tone="muted">
        max <span className="tabular-nums">{criterion.maxScore}</span>
      </Badge>
      {impact !== undefined && impact !== null && impact.scoreCount > 0 ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {impact.scoreCount} {impact.scoreCount === 1 ? "score" : "scores"}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onMove("up")}
        disabled={busy || isFirst}
        aria-label={`Move ${criterion.name} up`}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onMove("down")}
        disabled={busy || isLast}
        aria-label={`Move ${criterion.name} down`}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onEdit}
        disabled={busy}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onConfirmRemove}
        disabled={busy}
        aria-label={`Remove ${criterion.name}`}
      >
        <Trash2
          className="h-4 w-4 text-[var(--color-destructive)]"
          aria-hidden
        />
      </Button>
    </li>
  );
}

function CriterionFormModal({
  mode,
  open,
  onClose,
  initial,
  warning,
  onSubmit,
}: {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: Doc<"rubricCriteria"> | null;
  warning?: string;
  onSubmit: (values: CriterionFormValues) => Promise<void>;
}) {
  const nameId = useId();
  const maxId = useId();
  const nameErrId = useId();
  const maxErrId = useId();
  const form = useForm<CriterionFormValues>({
    resolver: zodResolver(criterionSchema),
    defaultValues: { name: "", maxScore: 5 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name ?? "",
        maxScore: initial?.maxScore ?? 5,
      });
    }
  }, [open, initial, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      toast.error(mode === "add" ? "Add failed" : "Update failed", {
        description: getConvexErrorMessage(
          err,
          mode === "add" ? "Add failed." : "Update failed.",
        ),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title={mode === "add" ? "Add rubric criterion" : "Edit rubric criterion"}
      description={
        mode === "add"
          ? "Internal evaluators will score every candidate on this criterion."
          : "Both fields are recorded against the audit log when changed."
      }
      size="md"
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {warning ? (
          <div className="rounded-md border border-[var(--copper)] bg-[var(--paper-2)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
            <span className="font-mono uppercase tracking-[0.18em] text-[var(--copper)]">
              Heads up:
            </span>{" "}
            {warning}
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            placeholder="e.g. Vision & Direction"
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? nameErrId : undefined
            }
            autoFocus={mode === "add"}
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p
              id={nameErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={maxId}>Max score (1&ndash;20)</Label>
          <Input
            id={maxId}
            type="number"
            min={1}
            max={20}
            step={1}
            aria-required="true"
            aria-invalid={form.formState.errors.maxScore ? "true" : undefined}
            aria-describedby={
              form.formState.errors.maxScore ? maxErrId : undefined
            }
            {...form.register("maxScore")}
          />
          {form.formState.errors.maxScore ? (
            <p
              id={maxErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.maxScore.message}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {mode === "add" ? (
              <>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden /> Save
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
