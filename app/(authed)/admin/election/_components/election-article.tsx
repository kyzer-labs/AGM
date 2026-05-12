"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  NEXT_PHASE_LABEL,
  PHASE_LABELS,
  PHASE_TONES,
  type Phase,
} from "./cycle-state";
import { RenameModal } from "./rename-modal";
import { RubricCriteriaPanel } from "./rubric-criteria-panel";
import { ScheduledWindowPanel } from "./scheduled-window-panel";
import { WeightsPanel } from "./weights-panel";

export function ElectionArticle({
  election,
  index = 0,
}: {
  election: Doc<"elections">;
  index?: number;
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

