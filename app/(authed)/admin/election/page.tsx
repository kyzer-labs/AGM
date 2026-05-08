"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Id } from "@/convex/_generated/dataModel";

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

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", year: new Date().getFullYear() },
  });

  if (elections === undefined) {
    return (
      <main className="container-wide py-10 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const onCreate = form.handleSubmit(async (values) => {
    try {
      await createElection(values);
      toast.success("Election created");
      form.reset({ name: "", year: new Date().getFullYear() });
    } catch (err) {
      const m = getConvexErrorMessage(err, "Could not create.");
      toast.error("Create failed", { description: m });
    }
  });

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Election cycle" }]} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Election cycles
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Each cycle holds positions, candidates, the Year-2 whitelist,
          internal evaluations, and final results.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New cycle</CardTitle>
          <CardDescription>
            Create a fresh AGM cycle. It starts in <strong>Setup</strong>{" "}
            phase — add positions, candidates, and the whitelist before
            opening the internal evaluation window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="USM CSS AGM 2026"
                {...form.register("name")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                {...form.register("year")}
              />
            </div>
            <Button type="submit" loading={form.formState.isSubmitting}>
              <CalendarPlus className="h-4 w-4" /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {elections.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title="No cycles yet"
          description="Create the first one above."
        />
      ) : (
        <div className="space-y-4">
          {elections.map((e) => (
            <ElectionCard
              key={e._id}
              electionId={e._id}
              name={e.name}
              year={e.year}
              phase={e.phase}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ElectionCard({
  electionId,
  name,
  year,
  phase,
}: {
  electionId: Id<"elections">;
  name: string;
  year: number;
  phase: string;
}) {
  const readiness = useQuery(api.elections.setupReadiness, { electionId });
  const transition = useMutation(api.elections.transitionPhase);
  const remove = useMutation(api.elections.remove);
  const rename = useMutation(api.elections.rename);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [busy, setBusy] = useState(false);

  const onTransition = async (toPhase: string) => {
    const reason =
      toPhase === "internalClosed" || toPhase === "internalOpen"
        ? window.prompt(
            `Reason for moving to "${PHASE_LABELS[toPhase]}"? (optional, written to audit log)`,
          ) ?? undefined
        : undefined;

    if (
      !window.confirm(
        `Move "${name}" to ${PHASE_LABELS[toPhase]}? This is logged.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await transition({
        electionId,
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
      const m = getConvexErrorMessage(err, "Phase change failed.");
      toast.error("Phase change failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete "${name}"? This permanently removes positions, candidates, and the whitelist for this cycle.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await remove({ electionId });
      toast.success("Election deleted");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Delete failed.");
      toast.error("Delete failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRename = async () => {
    setBusy(true);
    try {
      await rename({ electionId, name: draftName });
      toast.success("Renamed");
      setEditing(false);
    } catch (err) {
      const m = getConvexErrorMessage(err, "Rename failed.");
      toast.error("Rename failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

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
                  setDraftName(name);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="flex-1 text-lg">
                {name}{" "}
                <span className="text-[var(--color-muted-foreground)]">
                  · {year}
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
          <Badge tone={PHASE_TONES[phase] ?? "muted"}>
            {PHASE_LABELS[phase] ?? phase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {readiness ? (
          <div className="grid gap-3 sm:grid-cols-3">
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
            phase={phase}
            onTransition={onTransition}
            disabled={busy}
          />
          {phase === "setup" ? (
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
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
