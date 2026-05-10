"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Sliders,
  Trash2,
  X,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";

import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Phase = Doc<"elections">["phase"];

const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const PHASE_TONES: Record<
  Phase,
  "neutral" | "brand" | "success" | "warning" | "muted"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "neutral",
  publicVoting: "brand",
  resultsPreview: "warning",
  published: "success",
};

const NEXT_PHASE_LABEL: Partial<Record<Phase, { to: Phase; label: string }>> = {
  setup: { to: "internalOpen", label: "Open internal evaluation" },
  internalOpen: { to: "internalClosed", label: "Close internal evaluation" },
  internalClosed: { to: "publicVoting", label: "Start public voting" },
  publicVoting: { to: "resultsPreview", label: "Move to results preview" },
  resultsPreview: { to: "published", label: "Publish results" },
};

export default function ElectionPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const elections = useQuery(api.elections.list);
  const [showCreate, setShowCreate] = useState(false);

  if (elections === undefined) {
    return <PageSkeleton />;
  }

  const existingYears = elections.map((e) => e.year);

  return (
    <main className="container-wide space-y-12 py-12">
      <AdminBreadcrumb items={[{ label: "Election cycle" }]} />

      <header className="space-y-5">
        <SectionMarker primary="Election cycle" secondary="Annual cycles" />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Election cycles
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Each cycle holds positions, candidates, the internal whitelist
          (split across three voter classes), the rubric criteria, and the
          weighted scoring configuration. AGM is annual: at most one cycle
          per year.
        </p>
        <div>
          <Button
            onClick={() => setShowCreate(true)}
            disabled={!elections}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> New cycle
          </Button>
        </div>
      </header>

      <CreateCycleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        existingYears={existingYears}
      />

      {elections.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title="No cycles yet"
          description="Create the first one with the New cycle button above. The cycle starts in Setup with default weights and the standard 5-criterion rubric."
        />
      ) : (
        <ol className="space-y-0" aria-label="Election cycles">
          {elections.map((e, index) => (
            <li key={e._id}>
              <ElectionArticle election={e} index={index} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

const createSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  year: z.coerce
    .number({ invalid_type_error: "Year must be a number" })
    .int("Year must be a whole number")
    .min(2024, "Year must be 2024 or later")
    .max(2100, "Year must be 2100 or earlier"),
});
type CreateFormValues = z.infer<typeof createSchema>;

function CreateCycleModal({
  open,
  onClose,
  existingYears,
}: {
  open: boolean;
  onClose: () => void;
  existingYears: number[];
}) {
  const createElection = useMutation(api.elections.create);
  const nameId = useId();
  const yearId = useId();
  const nameErrId = useId();
  const yearErrId = useId();

  const schema = useMemo(
    () =>
      createSchema.superRefine((values, ctx) => {
        if (existingYears.includes(values.year)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["year"],
            message: `AGM ${values.year} already has a cycle. Delete it from Setup first if you want to recreate.`,
          });
        }
      }),
    [existingYears],
  );

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", year: new Date().getFullYear() },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "", year: new Date().getFullYear() });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createElection(values);
      toast.success("Cycle created", {
        description: `${values.name} (AGM ${values.year}) is now in Setup.`,
      });
      onClose();
    } catch (err) {
      toast.error("Create failed", {
        description: getConvexErrorMessage(err, "Could not create cycle."),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title="New election cycle"
      description={
        <>
          Starts in <strong className="font-semibold">Setup</strong> phase
          with default weights (30% TC, 20% HE, 10% Y2, 40% Public) and the
          standard 5-criterion rubric. Both can be edited before opening
          internal evaluation.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Cycle name</Label>
          <Input
            id={nameId}
            placeholder="USM CSS AGM 2026"
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? nameErrId : undefined
            }
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
          <Label htmlFor={yearId}>AGM year</Label>
          <Input
            id={yearId}
            type="number"
            min={2024}
            max={2100}
            step={1}
            aria-required="true"
            aria-invalid={form.formState.errors.year ? "true" : undefined}
            aria-describedby={
              form.formState.errors.year ? yearErrId : undefined
            }
            {...form.register("year")}
          />
          {form.formState.errors.year ? (
            <p
              id={yearErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.year.message}
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
            <CalendarPlus className="h-4 w-4" aria-hidden /> Create cycle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ElectionArticle({
  election,
  index,
}: {
  election: Doc<"elections">;
  index: number;
}) {
  const dialog = useDialog();
  const readiness = useQuery(api.elections.setupReadiness, {
    electionId: election._id,
  });
  const stats = useQuery(api.elections.cycleStats, {
    electionId: election._id,
  });
  const transition = useMutation(api.elections.transitionPhase);
  const remove = useMutation(api.elections.remove);
  const [showRename, setShowRename] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(election.phase !== "published");

  const showWeights = election.phase === "setup";
  const showSchedule =
    election.phase === "setup" || election.phase === "internalOpen";
  const showRubric = election.phase === "setup";

  const onTransition = async (toPhase: Phase) => {
    const wantsReason =
      toPhase === "internalClosed" || toPhase === "internalOpen";

    let reason: string | undefined;
    if (wantsReason) {
      const promptResult = await dialog.prompt({
        title: `Move to ${PHASE_LABELS[toPhase]}?`,
        description:
          "Optional note for the audit log. Leave blank if you do not need to record one.",
        label: "Audit note (optional)",
        placeholder: "e.g. opened by chairperson after orientation",
        confirmText: "Continue",
        multiline: true,
      });
      if (promptResult === null) return;
      reason =
        promptResult.trim().length > 0 ? promptResult.trim() : undefined;
    }

    const ok = await dialog.confirm({
      title: `Move to ${PHASE_LABELS[toPhase]}?`,
      description: (
        <>
          Move <strong className="font-semibold">{election.name}</strong> to{" "}
          <strong className="font-semibold">{PHASE_LABELS[toPhase]}</strong>.
          The phase change is written to the audit log. Any pending
          scheduled jobs are cancelled.
        </>
      ),
      confirmText: PHASE_LABELS[toPhase],
    });
    if (!ok) return;

    setBusy(true);
    try {
      await transition({
        electionId: election._id,
        toPhase,
        reason,
      });
      toast.success(`Phase changed to ${PHASE_LABELS[toPhase]}`);
    } catch (err) {
      toast.error("Phase change failed", {
        description: getConvexErrorMessage(err, "Phase change failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({
      title: "Delete this cycle?",
      description: (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{election.name}</strong> (AGM{" "}
          {election.year}). This removes every position, candidate, rubric
          criterion, and whitelist entry attached to this cycle. The action
          cannot be undone and is recorded in the audit log.
        </>
      ),
      confirmText: "Delete cycle",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await remove({ electionId: election._id });
      toast.success("Cycle deleted");
    } catch (err) {
      toast.error("Delete failed", {
        description: getConvexErrorMessage(err, "Delete failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const next = NEXT_PHASE_LABEL[election.phase];

  if (!open) {
    return (
      <article className="border-t border-[var(--ink-line)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="group flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 py-4 text-left transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--paper-2)]/40 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
        >
          <span
            className="font-mono text-lg font-medium tabular-nums text-[var(--ink-muted)] sm:text-xl"
            aria-hidden
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <SectionMarker
            primary={`AGM ${election.year}`}
            secondary={PHASE_LABELS[election.phase]}
          />
          <h2 className="font-display text-base font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-lg">
            {election.name}
          </h2>
          <Badge tone={PHASE_TONES[election.phase]}>
            {PHASE_LABELS[election.phase]}
          </Badge>
          <span className="ml-auto flex items-center gap-3">
            {readiness ? (
              <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)] sm:inline-flex">
                {readiness.positionsCount} pos
                <span aria-hidden className="mx-1.5 text-[var(--copper)]">
                  ·
                </span>
                {readiness.candidatesCount} cand
                <span aria-hidden className="mx-1.5 text-[var(--copper)]">
                  ·
                </span>
                {readiness.whitelistCount} whitelist
              </span>
            ) : null}
            <span
              className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]"
              aria-hidden
            >
              Open
              <ChevronDown className="h-3 w-3" aria-hidden />
            </span>
          </span>
        </button>
      </article>
    );
  }

  return (
    <article className="space-y-6 border-t border-[var(--ink-line)] pt-6 pb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span
          className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker
          primary={`AGM ${election.year}`}
          secondary={PHASE_LABELS[election.phase]}
        />
        <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl">
          {election.name}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRename(true)}
          aria-label={`Rename ${election.name}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={PHASE_TONES[election.phase]}>
            {PHASE_LABELS[election.phase]}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            aria-label={`Collapse ${election.name}`}
            className="font-mono text-[10.5px] uppercase tracking-[0.22em]"
          >
            Collapse
            <ChevronDown
              className="h-3 w-3 rotate-180"
              aria-hidden
            />
          </Button>
        </div>
      </div>

      <RenameModal
        open={showRename}
        onClose={() => setShowRename(false)}
        election={election}
      />

      {readiness ? (
        <MetaGroup className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Meta label="Positions" value={readiness.positionsCount} />
          <Meta label="Candidates" value={readiness.candidatesCount} />
          <Meta label="Whitelist" value={readiness.whitelistCount} />
          <Meta label="Rubric" value={readiness.rubricCriteriaCount} />
          <Meta
            label="Weights"
            value={
              <span
                className={cn(
                  readiness.weightsValid
                    ? "text-[var(--ink)]"
                    : "text-[var(--copper)]",
                )}
              >
                {readiness.weightsValid ? "100%" : "Invalid"}
              </span>
            }
          />
        </MetaGroup>
      ) : null}

      {readiness && readiness.warnings.length > 0 ? (
        <NoticeStrip
          markerPrimary="Setup checklist"
          markerSecondary={`${readiness.warnings.length} ${readiness.warnings.length === 1 ? "item" : "items"}`}
          markerIcon={
            <AlertTriangle
              className="h-4 w-4 text-[var(--copper)]"
              aria-hidden
            />
          }
          headline="Finish setup before opening evaluation"
          tone="copper"
        >
          <ul className="space-y-1.5 text-sm text-[var(--ink)]">
            {readiness.warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-[var(--copper)]">
                  ·
                </span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </NoticeStrip>
      ) : readiness?.ready ? (
        <NoticeStrip
          markerPrimary="Setup complete"
          markerSecondary="Ready"
          markerIcon={
            <CheckCircle2
              className="h-4 w-4 text-[var(--teal)]"
              aria-hidden
            />
          }
          headline="Ready to open the internal evaluation window"
          tone="neutral"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Every readiness check has passed. Use the action below to move
            into <strong className="font-semibold">Internal evaluation</strong>{" "}
            when the committee is ready.
          </p>
        </NoticeStrip>
      ) : null}

      {showWeights ? (
        <WeightsPanel election={election} stats={stats ?? null} />
      ) : null}
      {showSchedule ? <ScheduledWindowPanel election={election} /> : null}
      {showRubric ? (
        <RubricCriteriaPanel election={election} stats={stats ?? null} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--ink-line)] pt-3">
        <LinkButton href="/admin/positions" variant="outline" size="sm">
          Positions
        </LinkButton>
        <LinkButton href="/admin/candidates" variant="outline" size="sm">
          Candidates
        </LinkButton>
        <LinkButton href="/admin/whitelist" variant="outline" size="sm">
          Whitelist
        </LinkButton>
        <div className="flex-1" />
        {next ? (
          <Button
            size="sm"
            onClick={() => onTransition(next.to)}
            disabled={busy}
          >
            {next.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
        {election.phase === "setup" ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            loading={busy}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete cycle
          </Button>
        ) : null}
      </div>
    </article>
  );
}

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(80, "At most 80 characters"),
});
type RenameFormValues = z.infer<typeof renameSchema>;

function RenameModal({
  open,
  onClose,
  election,
}: {
  open: boolean;
  onClose: () => void;
  election: Doc<"elections">;
}) {
  const rename = useMutation(api.elections.rename);
  const nameId = useId();
  const errId = useId();

  const form = useForm<RenameFormValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: election.name },
  });

  useEffect(() => {
    if (open) form.reset({ name: election.name });
  }, [open, election.name, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.name === election.name) {
      onClose();
      return;
    }
    try {
      await rename({ electionId: election._id, name: values.name });
      toast.success("Renamed");
      onClose();
    } catch (err) {
      toast.error("Rename failed", {
        description: getConvexErrorMessage(err, "Rename failed."),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title="Rename cycle"
      description={
        <>
          The new name appears on every voter-facing surface that references
          this cycle.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Cycle name</Label>
          <Input
            id={nameId}
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? errId : undefined
            }
            autoFocus
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p
              id={errId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.name.message}
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
            <Save className="h-4 w-4" aria-hidden /> Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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

interface CycleStats {
  submittedEvaluations: number;
  draftEvaluations: number;
  totalEvaluations: number;
  lastSubmittedAt: number | null;
  publicVoteCount: number;
}

function WeightsPanel({
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

function describeCollectedData(stats: CycleStats): string {
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

function ScheduledWindowPanel({ election }: { election: Doc<"elections"> }) {
  const setScheduledWindow = useMutation(api.elections.setScheduledWindow);
  const clearScheduledWindow = useMutation(api.elections.clearScheduledWindow);
  const dialog = useDialog();

  const [start, setStart] = useState<string>(
    election.scheduledStartAt ? millisToInput(election.scheduledStartAt) : "",
  );
  const [end, setEnd] = useState<string>(
    election.scheduledEndAt ? millisToInput(election.scheduledEndAt) : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStart(
      election.scheduledStartAt
        ? millisToInput(election.scheduledStartAt)
        : "",
    );
    setEnd(
      election.scheduledEndAt ? millisToInput(election.scheduledEndAt) : "",
    );
  }, [election.scheduledStartAt, election.scheduledEndAt]);

  const startMs = start ? new Date(start).getTime() : undefined;
  const endMs = end ? new Date(end).getTime() : undefined;
  const orderInvalid =
    startMs !== undefined && endMs !== undefined && endMs <= startMs;

  const onSave = async () => {
    if (orderInvalid) {
      toast.error("End time must be after start time");
      return;
    }
    setBusy(true);
    try {
      await setScheduledWindow({
        electionId: election._id,
        startAt: startMs,
        endAt: endMs,
      });
      toast.success("Schedule saved");
    } catch (err) {
      toast.error("Save failed", {
        description: getConvexErrorMessage(err, "Save failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    const ok = await dialog.confirm({
      title: "Clear scheduled window?",
      description:
        "Cancels any pending open or close jobs. The phase stays where it is, so you'll need to transition it manually.",
      confirmText: "Clear schedule",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearScheduledWindow({ electionId: election._id });
      toast.success("Schedule cleared");
    } catch (err) {
      toast.error("Clear failed", {
        description: getConvexErrorMessage(err, "Clear failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const hasSchedule =
    election.scheduledStartAt !== undefined ||
    election.scheduledEndAt !== undefined;

  const startId = `sched-start-${election._id}`;
  const endId = `sched-end-${election._id}`;
  const orderErrId = `${endId}-err`;

  return (
    <section
      className="space-y-4 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-5"
      aria-labelledby={`schedule-heading-${election._id}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
        <h3
          id={`schedule-heading-${election._id}`}
          className="text-sm font-semibold text-[var(--ink)]"
        >
          Internal evaluation window
        </h3>
        <Badge tone="muted">
          {election.phase === "setup" ? "Setup or open" : "Active"}
        </Badge>
      </header>
      <p className="max-w-[60ch] text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        Optional auto-open and auto-close timestamps. Times are interpreted in
        your browser&apos;s local time zone but the cycle runs against
        Malaysia Time (MYT). The cycle moves into{" "}
        <strong className="font-semibold">Internal evaluation open</strong>{" "}
        at the start time (only if setup is ready) and into{" "}
        <strong className="font-semibold">Internal evaluation closed</strong>{" "}
        at the end time. Manual phase changes cancel any pending jobs.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={startId}>Start (auto-open)</Label>
          <Input
            id={startId}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={election.phase !== "setup"}
          />
          {election.phase !== "setup" ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Auto-open only triggers from Setup. This cycle is already past
              Setup.
            </span>
          ) : startMs ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {formatMYT(startMs)}
            </span>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={endId}>End (auto-close)</Label>
          <Input
            id={endId}
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={orderInvalid ? "true" : undefined}
            aria-describedby={orderInvalid ? orderErrId : undefined}
          />
          {orderInvalid ? (
            <span
              id={orderErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              End must be after start.
            </span>
          ) : endMs ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {formatMYT(endMs)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} loading={busy} size="sm">
            <Save className="h-4 w-4" aria-hidden /> Save schedule
          </Button>
          {hasSchedule ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={busy}
            >
              <X className="h-4 w-4" aria-hidden /> Clear
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function millisToInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function RubricCriteriaPanel({
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
