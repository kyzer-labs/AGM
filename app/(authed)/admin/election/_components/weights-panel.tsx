"use client";

import { useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, Sliders } from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

const weightsSchema = z
  .object({
    weightTopCommittee: z.coerce
      .number()
      .int("Must be a whole number")
      .min(0, "Must be 0 or more")
      .max(100, "Must be 100 or less"),
    weightHeadExecutive: z.coerce
      .number()
      .int("Must be a whole number")
      .min(0, "Must be 0 or more")
      .max(100, "Must be 100 or less"),
    weightYear2Committee: z.coerce
      .number()
      .int("Must be a whole number")
      .min(0, "Must be 0 or more")
      .max(100, "Must be 100 or less"),
    weightPublic: z.coerce
      .number()
      .int("Must be a whole number")
      .min(0, "Must be 0 or more")
      .max(100, "Must be 100 or less"),
  })
  .refine(
    (v) =>
      v.weightTopCommittee +
        v.weightHeadExecutive +
        v.weightYear2Committee +
        v.weightPublic ===
      100,
    { message: "Weights must sum to exactly 100%." },
  );
type WeightsFormValues = z.infer<typeof weightsSchema>;

export interface CycleStats {
  submittedEvaluations: number;
  draftEvaluations: number;
  totalEvaluations: number;
  lastSubmittedAt: number | null;
  publicVoteCount: number;
}

export function WeightsPanel({
  election,
  stats,
}: {
  election: Doc<"elections">;
  stats: CycleStats | null;
}) {
  const dialog = useDialog();
  const setWeights = useMutation(api.elections.setWeights);

  const initial = useMemo(
    () => ({
      weightTopCommittee: election.weightTopCommittee ?? 30,
      weightHeadExecutive: election.weightHeadExecutive ?? 20,
      weightYear2Committee: election.weightYear2Committee ?? 10,
      weightPublic: election.weightPublic ?? 40,
    }),
    [election],
  );

  const form = useForm<WeightsFormValues>({
    resolver: zodResolver(weightsSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    form.reset(initial);
  }, [initial, form]);

  const values = form.watch();
  const sum =
    Number(values.weightTopCommittee || 0) +
    Number(values.weightHeadExecutive || 0) +
    Number(values.weightYear2Committee || 0) +
    Number(values.weightPublic || 0);
  const sumOk = sum === 100;

  const hasCollectedData =
    (stats?.submittedEvaluations ?? 0) +
      (stats?.draftEvaluations ?? 0) +
      (stats?.publicVoteCount ?? 0) >
    0;

  const onSubmit = form.handleSubmit(async (v) => {
    const changed =
      v.weightTopCommittee !== initial.weightTopCommittee ||
      v.weightHeadExecutive !== initial.weightHeadExecutive ||
      v.weightYear2Committee !== initial.weightYear2Committee ||
      v.weightPublic !== initial.weightPublic;
    if (!changed) return;

    if (hasCollectedData && stats) {
      const summary = describeCollectedData(stats);
      const ok = await dialog.confirm({
        title: "Change weights with data already collected?",
        description: (
          <>
            {summary} Re-saving the weight split now changes how those
            existing scores combine into final results. Submitted scores are
            not retroactively rescaled.
          </>
        ),
        confirmText: "Save weights",
        variant: "destructive",
      });
      if (!ok) return;
    }

    try {
      await setWeights({
        electionId: election._id,
        weightTopCommittee: v.weightTopCommittee,
        weightHeadExecutive: v.weightHeadExecutive,
        weightYear2Committee: v.weightYear2Committee,
        weightPublic: v.weightPublic,
      });
      toast.success("Weights saved");
    } catch (err) {
      toast.error("Save failed", {
        description: getConvexErrorMessage(err, "Save failed."),
      });
    }
  });

  return (
    <section
      className="space-y-4 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-5"
      aria-labelledby={`weights-heading-${election._id}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Sliders
          className="h-4 w-4 text-[var(--ink-muted)]"
          aria-hidden
        />
        <h3
          id={`weights-heading-${election._id}`}
          className="text-sm font-semibold text-[var(--ink)]"
        >
          Scoring weights
        </h3>
        <Badge tone="muted">Setup only</Badge>
      </header>
      <p className="max-w-[60ch] text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        Internal classes (TC, HE, Y2) and Public must sum to 100%. Frozen
        once internal evaluation opens. The internal aggregate is derived
        from each class&apos;s sum-of-totals share, then weighted with the
        public-vote share.
      </p>

      {hasCollectedData && stats ? (
        <div className="rounded-md border border-[var(--copper)] bg-[var(--paper)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
          <span className="font-mono uppercase tracking-[0.18em] text-[var(--copper)]">
            Heads up:
          </span>{" "}
          {describeCollectedData(stats)} Saving here will not retroactively
          rescale existing scores.
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end"
        noValidate
      >
        <WeightField
          id="wTc"
          label="Top Committee"
          register={form.register("weightTopCommittee")}
          error={form.formState.errors.weightTopCommittee?.message}
        />
        <WeightField
          id="wHe"
          label="Head Executive"
          register={form.register("weightHeadExecutive")}
          error={form.formState.errors.weightHeadExecutive?.message}
        />
        <WeightField
          id="wY2"
          label="Year 2 Committee"
          register={form.register("weightYear2Committee")}
          error={form.formState.errors.weightYear2Committee?.message}
        />
        <WeightField
          id="wPub"
          label="Public"
          register={form.register("weightPublic")}
          error={form.formState.errors.weightPublic?.message}
        />
        <div className="grid gap-2">
          <span
            className={cn(
              "font-mono text-[10.5px] uppercase tracking-[0.2em] tabular-nums",
              sumOk
                ? "text-[var(--ink-muted)]"
                : "text-[var(--copper)]",
            )}
            role="status"
            aria-live="polite"
          >
            Sum: {sum}%
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!sumOk || !form.formState.isDirty}
            loading={form.formState.isSubmitting}
          >
            <Save className="h-4 w-4" aria-hidden /> Save
          </Button>
        </div>
      </form>
    </section>
  );
}

export function describeCollectedData(stats: CycleStats): string {
  const parts: string[] = [];
  if (stats.submittedEvaluations > 0) {
    if (stats.lastSubmittedAt) {
      parts.push(
        `${stats.submittedEvaluations} submitted ${stats.submittedEvaluations === 1 ? "evaluation" : "evaluations"} (last on ${formatMYT(stats.lastSubmittedAt)})`,
      );
    } else {
      parts.push(
        `${stats.submittedEvaluations} submitted ${stats.submittedEvaluations === 1 ? "evaluation" : "evaluations"}`,
      );
    }
  }
  if (stats.draftEvaluations > 0) {
    parts.push(
      `${stats.draftEvaluations} draft ${stats.draftEvaluations === 1 ? "evaluation" : "evaluations"}`,
    );
  }
  if (stats.publicVoteCount > 0) {
    parts.push(
      `${stats.publicVoteCount} public ${stats.publicVoteCount === 1 ? "vote" : "votes"}`,
    );
  }
  if (parts.length === 0) return "No data has been collected yet.";
  return `${parts.join(", ")} already exist for this cycle.`;
}

function WeightField({
  id,
  label,
  register,
  error,
}: {
  id: string;
  label: string;
  register: ReturnType<ReturnType<typeof useForm<WeightsFormValues>>["register"]>;
  error?: string;
}) {
  const errId = `${id}-err`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        step={1}
        aria-required="true"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errId : undefined}
        {...register}
      />
      {error ? (
        <span
          id={errId}
          role="alert"
          className="text-xs text-[var(--color-destructive)]"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

