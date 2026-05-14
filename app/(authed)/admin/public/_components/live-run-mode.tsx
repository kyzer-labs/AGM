"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Lock,
  Pause,
  Play,
} from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYTTimeOnly } from "@/lib/format";
import {
  CascadePreview,
  LiveCounts,
  UnresolvedTieStrip,
  WinnerStrip,
} from "./live-vote-panels";
import type { SessionRow } from "./public-model";

export function LiveRunMode({
  rows,
  electionId,
  candidateNameById,
  phaseOk,
  onResolveTie,
}: {
  rows: SessionRow[];
  electionId: Id<"elections">;
  candidateNameById: Map<Id<"candidates">, string>;
  phaseOk: boolean;
  onResolveTie: (row: SessionRow) => void;
}) {
  const focus = useMemo(() => {
    const unresolved = rows.find((row) => row.hasUnresolvedTie);
    if (unresolved) return { row: unresolved, mode: "tie" as const };

    const active = rows.find((row) => row.sessionStatus === "active");
    if (active) return { row: active, mode: "active" as const };

    const pending = rows.find((row) => row.sessionStatus === "pending");
    if (pending) return { row: pending, mode: "next" as const };

    const closed = rows
      .slice()
      .reverse()
      .find((row) => row.sessionStatus === "closed");
    return closed ? { row: closed, mode: "complete" as const } : null;
  }, [rows]);

  if (!focus) return null;

  return (
    <LiveRunPanel
      focus={focus}
      electionId={electionId}
      candidateNameById={candidateNameById}
      phaseOk={phaseOk}
      onResolveTie={() => onResolveTie(focus.row)}
    />
  );
}

function LiveRunPanel({
  focus,
  electionId,
  candidateNameById,
  phaseOk,
  onResolveTie,
}: {
  focus: {
    row: SessionRow;
    mode: "active" | "tie" | "next" | "complete";
  };
  electionId: Id<"elections">;
  candidateNameById: Map<Id<"candidates">, string>;
  phaseOk: boolean;
  onResolveTie: () => void;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const start = useMutation(api.sessions.startSession);
  const close = useMutation(api.sessions.closeSession);
  const { row, mode } = focus;

  const liveCounts = useQuery(
    api.sessions.liveCounts,
    row.sessionStatus === "active" || row.sessionStatus === "closed"
      ? { positionId: row.positionId }
      : "skip",
  );

  const cascade = useQuery(
    api.sessions.previewCascade,
    row.sessionStatus === "pending" && phaseOk
      ? { electionId, positionId: row.positionId }
      : "skip",
  );

  const onStart = async () => {
    const ok = await dialog.confirm({
      title: "Open this ballot?",
      description: (
        <>
          Opens public voting for{" "}
          <strong className="font-semibold">{row.name}</strong> (Tier{" "}
          {row.tier}). Every signed-in non-evaluator can cast one vote until
          you close the ballot.
        </>
      ),
      confirmText: "Open ballot",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await start({ positionId: row.positionId });
      toast.success(`Opened: ${row.name}`);
    } catch (err) {
      toast.error("Open failed", {
        description: getConvexErrorMessage(err, "Failed to open."),
      });
    } finally {
      setBusy(false);
    }
  };

  const onClose = async () => {
    const liveTotal = liveCounts?.total ?? row.voteCount;
    const ok = await dialog.confirm({
      title: "Close this ballot?",
      description: (
        <>
          Closes voting for{" "}
          <strong className="font-semibold">{row.name}</strong>.{" "}
          <strong className="font-semibold tabular-nums">
            {liveTotal} {liveTotal === 1 ? "vote" : "votes"}
          </strong>{" "}
          will be recorded. The winner is computed immediately and this cannot
          be reopened.
        </>
      ),
      confirmText: "Close ballot",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await close({ positionId: row.positionId });
      if (result.tieGroup.length > 0) {
        toast.warning("Tie detected", {
          description: "Resolve manually before opening the next ballot.",
        });
      } else {
        const winnerName = result.winnerCandidateId
          ? candidateNameById.get(result.winnerCandidateId) ?? "-"
          : "-";
        toast.success(`Closed. Winner: ${winnerName}`);
      }
    } catch (err) {
      toast.error("Close failed", {
        description: getConvexErrorMessage(err, "Failed to close."),
      });
    } finally {
      setBusy(false);
    }
  };

  const status = (() => {
    if (mode === "tie") {
      return (
        <Badge tone="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Tie requires decision
        </Badge>
      );
    }
    if (mode === "active") {
      return (
        <Badge tone="brand">
          <Circle className="h-3 w-3 fill-current" aria-hidden />
          Live now
        </Badge>
      );
    }
    if (mode === "complete") {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          All ballots closed
        </Badge>
      );
    }
    return (
      <Badge tone={phaseOk ? "muted" : "warning"}>
        <Lock className="h-3 w-3" aria-hidden />
        Next ballot
      </Badge>
    );
  })();

  const startedAt = row.sessionStartedAt
    ? formatMYTTimeOnly(row.sessionStartedAt)
    : null;
  const closedAt = row.sessionClosedAt
    ? formatMYTTimeOnly(row.sessionClosedAt)
    : null;

  return (
    <section
      aria-label="Live run mode"
      className="grid gap-6 border-y border-[var(--ink-line)] bg-[var(--paper-2)] px-4 py-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:px-6"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionMarker primary="Run mode" secondary="Current action" />
          {status}
        </div>
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
            Tier {row.tier} / Ballot order {row.order + 1}
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-[var(--ink)]">
            {row.name}
          </h2>
        </div>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {mode === "active"
            ? `Voting is open${startedAt ? ` since ${startedAt}` : ""}. Keep this panel visible until the chair closes the ballot.`
            : mode === "tie"
              ? "A closed ballot needs a manual winner before the next ballot opens."
              : mode === "complete"
                ? `The most recent ballot closed${closedAt ? ` at ${closedAt}` : ""}. Move to results preview once every position is checked.`
                : phaseOk
                  ? "This is the next ballot in sequence. Open it only when the room is ready."
                  : "Move the cycle to Public AGM voting before opening ballots."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {mode === "next" && phaseOk ? (
            <Button onClick={onStart} loading={busy}>
              <Play className="h-4 w-4" aria-hidden /> Open ballot
            </Button>
          ) : null}
          {mode === "active" ? (
            <Button onClick={onClose} loading={busy} variant="destructive">
              <Pause className="h-4 w-4" aria-hidden /> Close ballot
            </Button>
          ) : null}
          {mode === "tie" ? (
            <Button onClick={onResolveTie} variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Resolve tie
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        {row.sessionStatus === "pending" && phaseOk && cascade ? (
          <CascadePreview cascade={cascade} />
        ) : null}
        {liveCounts && row.sessionStatus !== "pending" ? (
          <LiveCounts
            counts={liveCounts.counts}
            total={liveCounts.total}
            highlightWinnerId={
              row.sessionStatus === "closed" && !row.hasUnresolvedTie
                ? row.winnerCandidateId
                : null
            }
          />
        ) : null}
        {row.sessionStatus === "closed" &&
        row.winnerCandidateId &&
        !row.hasUnresolvedTie ? (
          <WinnerStrip
            name={candidateNameById.get(row.winnerCandidateId) ?? "Unknown"}
          />
        ) : null}
        {row.hasUnresolvedTie ? (
          <UnresolvedTieStrip onResolve={onResolveTie} />
        ) : null}
      </div>
    </section>
  );
}
