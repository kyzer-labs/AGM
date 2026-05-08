"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ListChecks,
  Plus,
  Save,
  Sliders,
  Trash2,
  X,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";

const PHASE_LABELS: Record<string, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const PHASE_TONES: Record<
  string,
  "neutral" | "brand" | "success" | "warning" | "muted"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "neutral",
  publicVoting: "brand",
  resultsPreview: "warning",
  published: "success",
};

export default function ElectionPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Too short").max(80, "Too long"),
  year: z.coerce.number().int().min(2024).max(2100),
});
type CreateFormValues = z.infer<typeof createSchema>;

function Inner() {
  const elections = useQuery(api.elections.list);
  const createElection = useMutation(api.elections.create);

  const [showCreate, setShowCreate] = useState(false);
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", year: new Date().getFullYear() },
  });

  const onCreate = form.handleSubmit(async (values) => {
    try {
      await createElection(values);
      toast.success("Election created");
      form.reset({ name: "", year: new Date().getFullYear() });
      setShowCreate(false);
    } catch (err) {
      const m = friendlyError(err, "Could not create.");
      toast.error("Create failed", { description: m });
    }
  });

  if (elections === undefined) {
    return (
      <main className="container-wide py-10 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Election cycle" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Election cycles
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Each cycle holds positions, candidates, the internal whitelist
            (split across three voter classes), the rubric criteria, and the
            weighted scoring configuration.
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({ name: "", year: new Date().getFullYear() });
            setShowCreate(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" /> New cycle
        </Button>
      </header>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New election cycle"
        description={
          <>
            Starts in <strong>Setup</strong> phase with default weights (30%
            TC + 20% HE + 10% Y2 + 40% Public) and the standard 5-criterion
            rubric. You can change both before opening internal evaluation.
          </>
        }
        size="md"
      >
        <form onSubmit={onCreate} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="USM CSS AGM 2026"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" {...form.register("year")} />
            {form.formState.errors.year ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {form.formState.errors.year.message}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              <CalendarPlus className="h-4 w-4" /> Create
            </Button>
          </div>
        </form>
      </Modal>

      {elections.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title="No cycles yet"
          description="Create the first one with the New cycle button above."
        />
      ) : (
        <div className="space-y-4">
          {elections.map((e) => (
            <ElectionCard key={e._id} election={e} />
          ))}
        </div>
      )}
    </main>
  );
}

function ElectionCard({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const readiness = useQuery(api.elections.setupReadiness, {
    electionId: election._id,
  });
  const transition = useMutation(api.elections.transitionPhase);
  const remove = useMutation(api.elections.remove);
  const rename = useMutation(api.elections.rename);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(election.name);
  const [busy, setBusy] = useState(false);

  const onTransition = async (toPhase: string) => {
    const wantsReason =
      toPhase === "internalClosed" || toPhase === "internalOpen";

    let reason: string | undefined;
    if (wantsReason) {
      const promptResult = await dialog.prompt({
        title: `Move to ${PHASE_LABELS[toPhase] ?? toPhase}?`,
        description: (
          <>
            Optional note for the audit log. Leave blank if you don&apos;t
            need to record one.
          </>
        ),
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
      title: `Move to ${PHASE_LABELS[toPhase] ?? toPhase}?`,
      description: (
        <>
          Move <strong>{election.name}</strong> to{" "}
          <strong>{PHASE_LABELS[toPhase] ?? toPhase}</strong>. This phase
          transition is logged. Any pending scheduled jobs will be
          cancelled.
        </>
      ),
      confirmText: PHASE_LABELS[toPhase] ?? "Confirm",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await transition({
        electionId: election._id,
        toPhase: toPhase as
          | "setup"
          | "internalOpen"
          | "internalClosed"
          | "publicVoting"
          | "resultsPreview"
          | "published",
        reason,
      });
      toast.success(`Phase changed to ${PHASE_LABELS[toPhase]}`);
    } catch (err) {
      const m = friendlyError(err, "Phase change failed.");
      toast.error("Phase change failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({
      title: "Delete cycle?",
      description: (
        <>
          Delete <strong>{election.name}</strong>. This permanently removes
          positions, candidates, rubric criteria, and the whitelist for
          this cycle. Cannot be undone.
        </>
      ),
      confirmText: "Delete cycle",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await remove({ electionId: election._id });
      toast.success("Election deleted");
    } catch (err) {
      const m = friendlyError(err, "Delete failed.");
      toast.error("Delete failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRename = async () => {
    setBusy(true);
    try {
      await rename({ electionId: election._id, name: draftName });
      toast.success("Renamed");
      setEditing(false);
    } catch (err) {
      const m = friendlyError(err, "Rename failed.");
      toast.error("Rename failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const showWeights = election.phase === "setup";
  const showSchedule =
    election.phase === "setup" || election.phase === "internalOpen";
  const showRubric = election.phase === "setup";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <Button onClick={onRename} loading={busy} size="sm">
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setDraftName(election.name);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="flex-1 text-lg">
                {election.name}{" "}
                <span className="text-[var(--color-muted-foreground)]">
                  · {election.year}
                </span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Rename
              </Button>
            </>
          )}
          <Badge tone={PHASE_TONES[election.phase] ?? "muted"}>
            {PHASE_LABELS[election.phase] ?? election.phase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {readiness ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Positions"
              value={String(readiness.positionsCount)}
            />
            <Stat
              label="Candidates"
              value={String(readiness.candidatesCount)}
            />
            <Stat
              label="Whitelist"
              value={String(readiness.whitelistCount)}
            />
            <Stat
              label="Rubric criteria"
              value={String(readiness.rubricCriteriaCount)}
            />
            <Stat
              label="Weights"
              value={readiness.weightsValid ? "100%" : "Invalid"}
              tone={readiness.weightsValid ? "ok" : "warn"}
            />
          </div>
        ) : null}

        {readiness && readiness.warnings.length > 0 ? (
          <div className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-[var(--color-warning)]" />
              Setup checklist
            </div>
            <ul className="ml-5 list-disc text-xs text-[var(--color-foreground)]">
              {readiness.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : readiness?.ready ? (
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            Setup complete — ready to open the internal evaluation window.
          </div>
        ) : null}

        {showWeights ? <WeightsPanel election={election} /> : null}
        {showSchedule ? <ScheduledWindowPanel election={election} /> : null}
        {showRubric ? <RubricCriteriaPanel election={election} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/positions">
            <Button variant="outline" size="sm">
              Positions
            </Button>
          </Link>
          <Link href="/admin/candidates">
            <Button variant="outline" size="sm">
              Candidates
            </Button>
          </Link>
          <Link href="/admin/whitelist">
            <Button variant="outline" size="sm">
              Whitelist
            </Button>
          </Link>
          <div className="flex-1" />
          <PhaseButtons
            phase={election.phase}
            onTransition={onTransition}
            disabled={busy}
          />
          {election.phase === "setup" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              loading={busy}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const valueColor =
    tone === "ok"
      ? "text-[var(--color-success)]"
      : tone === "warn"
        ? "text-[var(--color-warning)]"
        : undefined;
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className={`text-xl font-semibold ${valueColor ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

const weightsSchema = z
  .object({
    weightTopCommittee: z.coerce.number().int().min(0).max(100),
    weightHeadExecutive: z.coerce.number().int().min(0).max(100),
    weightYear2Committee: z.coerce.number().int().min(0).max(100),
    weightPublic: z.coerce.number().int().min(0).max(100),
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

function WeightsPanel({ election }: { election: Doc<"elections"> }) {
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

  const onSubmit = form.handleSubmit(async (v) => {
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
      const m = friendlyError(err, "Save failed.");
      toast.error("Save failed", { description: m });
    }
  });

  return (
    <section className="rounded-md border p-4">
      <header className="mb-3 flex items-center gap-2">
        <Sliders className="h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Scoring weights</h2>
        <Badge tone="muted">Setup only</Badge>
      </header>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Internal classes (TC + HE + Y2) and Public must sum to 100%. Locked
        once the internal evaluation is opened. The internal aggregate is
        derived from each class&apos;s sum-of-totals share, then weighted
        with the public-vote share.
      </p>
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end"
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
            className={`text-xs ${
              sumOk
                ? "text-[var(--color-success)]"
                : "text-[var(--color-warning)]"
            }`}
          >
            Sum: {sum}%
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!sumOk}
            loading={form.formState.isSubmitting}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </form>
    </section>
  );
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
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        step={1}
        {...register}
      />
      {error ? (
        <span className="text-xs text-[var(--color-destructive)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function ScheduledWindowPanel({ election }: { election: Doc<"elections"> }) {
  const setScheduledWindow = useMutation(api.elections.setScheduledWindow);
  const clearScheduledWindow = useMutation(
    api.elections.clearScheduledWindow,
  );
  const dialog = useDialog();

  const [start, setStart] = useState<string>(
    election.scheduledStartAt
      ? millisToInput(election.scheduledStartAt)
      : "",
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
      election.scheduledEndAt
        ? millisToInput(election.scheduledEndAt)
        : "",
    );
  }, [election.scheduledStartAt, election.scheduledEndAt]);

  const onSave = async () => {
    const startMs = start ? new Date(start).getTime() : undefined;
    const endMs = end ? new Date(end).getTime() : undefined;
    if (startMs !== undefined && endMs !== undefined && endMs <= startMs) {
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
      const m = friendlyError(err, "Save failed.");
      toast.error("Save failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    const ok = await dialog.confirm({
      title: "Clear scheduled window?",
      description:
        "Cancels any pending open/close jobs. The phase stays where it is — you'll need to transition it manually.",
      confirmText: "Clear schedule",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearScheduledWindow({ electionId: election._id });
      toast.success("Schedule cleared");
    } catch (err) {
      const m = friendlyError(err, "Clear failed.");
      toast.error("Clear failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const hasSchedule =
    election.scheduledStartAt !== undefined ||
    election.scheduledEndAt !== undefined;

  return (
    <section className="rounded-md border p-4">
      <header className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Internal evaluation window</h2>
        <Badge tone="muted">
          {election.phase === "setup" ? "Setup or open" : "Active"}
        </Badge>
      </header>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Optional auto-open and auto-close timestamps. The cycle moves into{" "}
        <strong>Internal evaluation open</strong> at the start time (only if
        setup is ready) and into <strong>Internal evaluation closed</strong>{" "}
        at the end time. Manual phase changes cancel any pending jobs.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="schedStart">Start (auto-open)</Label>
          <Input
            id="schedStart"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={election.phase !== "setup"}
          />
          {election.phase !== "setup" ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Auto-open only triggers from Setup; cycle is already past
              Setup.
            </span>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="schedEnd">End (auto-close)</Label>
          <Input
            id="schedEnd"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} loading={busy} size="sm">
            <Save className="h-4 w-4" /> Save schedule
          </Button>
          {hasSchedule ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={busy}
            >
              <X className="h-4 w-4" /> Clear
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

function RubricCriteriaPanel({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const criteria = useQuery(api.rubric.list, { electionId: election._id });
  const add = useMutation(api.rubric.add);
  const renameC = useMutation(api.rubric.rename);
  const setMaxScore = useMutation(api.rubric.setMaxScore);
  const removeC = useMutation(api.rubric.remove);
  const move = useMutation(api.rubric.move);
  const seedDefaults = useMutation(api.rubric.seedDefaults);

  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const onAdd = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      toast.error("Name too short");
      return;
    }
    setBusy(true);
    try {
      await add({
        electionId: election._id,
        name,
        maxScore: newMax,
      });
      setNewName("");
      setNewMax(5);
      setShowAdd(false);
      toast.success("Criterion added");
    } catch (err) {
      const m = friendlyError(err, "Add failed.");
      toast.error("Add failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onSeed = async () => {
    const ok = await dialog.confirm({
      title: "Seed default criteria?",
      description:
        "Adds the standard 5-criterion rubric (Leadership, Teamwork, Professionalism, Commitment, Personality) at max score 5 each. Only works when the rubric is empty.",
      confirmText: "Seed defaults",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const count = await seedDefaults({ electionId: election._id });
      toast.success(`Seeded ${count} criteria`);
    } catch (err) {
      const m = friendlyError(err, "Seed failed.");
      toast.error("Seed failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRename = async (
    criterionId: Id<"rubricCriteria">,
    currentName: string,
  ) => {
    const next = await dialog.prompt({
      title: "Rename criterion",
      description: (
        <>
          Rename <strong>{currentName}</strong>. The change applies to all
          existing draft scores under this criterion.
        </>
      ),
      label: "New name",
      defaultValue: currentName,
      required: true,
      validate: (v) =>
        v.trim().length < 2 ? "At least 2 characters" : null,
    });
    if (!next || next.trim() === currentName) return;
    setBusy(true);
    try {
      await renameC({ criterionId, name: next.trim() });
      toast.success("Renamed");
    } catch (err) {
      const m = friendlyError(err, "Rename failed.");
      toast.error("Rename failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onSetMax = async (
    criterionId: Id<"rubricCriteria">,
    currentMax: number,
  ) => {
    const next = await dialog.prompt({
      title: "Set max score",
      description:
        "Update the maximum value evaluators can give for this criterion. Must be an integer between 1 and 20.",
      label: "Max score",
      defaultValue: String(currentMax),
      required: true,
      validate: (v) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 20)
          return "Integer between 1 and 20";
        return null;
      },
    });
    if (!next) return;
    const value = Number(next);
    if (value === currentMax) return;
    setBusy(true);
    try {
      await setMaxScore({ criterionId, maxScore: value });
      toast.success("Max score updated");
    } catch (err) {
      const m = friendlyError(err, "Update failed.");
      toast.error("Update failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (
    criterionId: Id<"rubricCriteria">,
    currentName: string,
  ) => {
    const ok = await dialog.confirm({
      title: "Remove criterion?",
      description: (
        <>
          Removes <strong>{currentName}</strong> and any draft scores tied
          to it. Cannot be undone.
        </>
      ),
      confirmText: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeC({ criterionId });
      toast.success("Removed");
    } catch (err) {
      const m = friendlyError(err, "Remove failed.");
      toast.error("Remove failed", { description: m });
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
      const m = friendlyError(err, "Move failed.");
      toast.error("Move failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-md border p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <ListChecks className="h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Rubric criteria</h2>
        <Badge tone="muted">Setup only</Badge>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => {
            setNewName("");
            setNewMax(5);
            setShowAdd(true);
          }}
          disabled={busy}
        >
          <Plus className="h-4 w-4" /> Add criterion
        </Button>
      </header>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Internal evaluators score every candidate on every criterion. Each
        criterion has its own max score (1–20). Once internal evaluation
        opens, the rubric is frozen for the rest of the cycle.
      </p>

      {criteria === undefined ? (
        <Skeleton className="h-20 w-full" />
      ) : criteria.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No criteria yet. Seed the default rubric or add one manually.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSeed}
            disabled={busy}
          >
            <Plus className="h-4 w-4" /> Seed default rubric
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {criteria.map((c, idx) => (
            <li
              key={c._id}
              className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="w-6 text-xs text-[var(--color-muted-foreground)]">
                {idx + 1}
              </span>
              <span className="flex-1 font-medium">{c.name}</span>
              <Badge tone="muted">max {c.maxScore}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMove(c._id, "up")}
                disabled={busy || idx === 0}
                aria-label={`Move ${c.name} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMove(c._id, "down")}
                disabled={busy || idx === criteria.length - 1}
                aria-label={`Move ${c.name} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRename(c._id, c.name)}
                disabled={busy}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetMax(c._id, c.maxScore)}
                disabled={busy}
              >
                Max score
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRemove(c._id, c.name)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add rubric criterion"
        description="Internal evaluators will score every candidate on this criterion."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onAdd();
          }}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="critName">Name</Label>
            <Input
              id="critName"
              placeholder="e.g. Vision & Direction"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="critMax">Max score (1–20)</Label>
            <Input
              id="critMax"
              type="number"
              min={1}
              max={20}
              step={1}
              value={newMax}
              onChange={(e) => setNewMax(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={busy}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function PhaseButtons({
  phase,
  onTransition,
  disabled,
}: {
  phase: string;
  onTransition: (to: string) => void | Promise<void>;
  disabled: boolean;
}) {
  const next: { to: string; label: string }[] = [];
  if (phase === "setup")
    next.push({ to: "internalOpen", label: "Open internal" });
  if (phase === "internalOpen")
    next.push({ to: "internalClosed", label: "Close internal" });
  if (phase === "internalClosed")
    next.push({ to: "publicVoting", label: "Start public voting" });
  if (phase === "publicVoting")
    next.push({ to: "resultsPreview", label: "Move to results preview" });
  if (phase === "resultsPreview")
    next.push({ to: "published", label: "Publish results" });

  return (
    <>
      {next.map((n) => (
        <Button
          key={n.to}
          size="sm"
          onClick={() => onTransition(n.to)}
          disabled={disabled}
        >
          {n.label} <ArrowRight className="h-4 w-4" />
        </Button>
      ))}
    </>
  );
}
