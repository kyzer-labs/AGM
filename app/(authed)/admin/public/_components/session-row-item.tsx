"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Pause,
  Play,
} from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYTTimeOnly } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CascadePreview,
  LiveCounts,
  UnresolvedTieStrip,
  WinnerStrip,
} from "./live-vote-panels";
import type { SessionRow } from "./public-model";

export function SessionRowItem({
  row,
  index,
  electionId,
  candidateNameById,
  phaseOk,
  onResolveTie,
}: {
  row: SessionRow;
  index: number;
  electionId: Id<"elections">;
  candidateNameById: Map<Id<"candidates">, string>;
  phaseOk: boolean;
  onResolveTie: () => void;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const start = useMutation(api.sessions.startSession);
  const close = useMutation(api.sessions.closeSession);

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
          you close the ballot. The vote count appears live on this page.
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
      const m = getConvexErrorMessage(err, "Failed to open.");
      toast.error("Open failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onClose = async () => {
    const liveTotal = liveCounts?.total ?? row.voteCount;
    const openedAt = row.sessionStartedAt
      ? formatMYTTimeOnly(row.sessionStartedAt)
      : null;
    const ok = await dialog.confirm({
      title: "Close this ballot?",
      description: (
        <>
          Closes voting for{" "}
          <strong className="font-semibold">{row.name}</strong>.{" "}
          <strong className="font-semibold tabular-nums">
            {liveTotal} {liveTotal === 1 ? "vote" : "votes"}
          </strong>{" "}
          {openedAt ? (
            <>cast since opened {openedAt}</>
          ) : (
            <>cast so far</>
          )}
          . The winner is computed immediately and the cascade updates the
          remaining positions. This cannot be reopened.
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
      const m = getConvexErrorMessage(err, "Failed to close.");
      toast.error("Close failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (() => {
    if (row.hasUnresolvedTie) {
      return (
        <Badge tone="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Tie: resolve
        </Badge>
      );
    }
    if (row.sessionStatus === "active") {
      return (
        <Badge tone="brand">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          />
          Open
        </Badge>
      );
    }
    if (row.sessionStatus === "closed") {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Closed
        </Badge>
      );
    }
    return (
      <Badge tone="muted">
        <Lock className="h-3 w-3" aria-hidden />
        Pending
      </Badge>
    );
  })();

  const stateLine = (() => {
    if (row.sessionStatus === "active" && row.sessionStartedAt) {
      const total = liveCounts?.total ?? row.voteCount;
      return `Ballot opened ${formatMYTTimeOnly(row.sessionStartedAt)}. ${total} ${total === 1 ? "vote" : "votes"} cast. Closes when you press Close ballot.`;
    }
    if (row.sessionStatus === "closed" && row.sessionClosedAt) {
      const opened = row.sessionStartedAt
        ? formatMYTTimeOnly(row.sessionStartedAt)
        : null;
      const total = row.voteCount;
      return `Ballot closed ${formatMYTTimeOnly(row.sessionClosedAt)}${
        opened ? `, open ${opened}` : ""
      }. ${total} ${total === 1 ? "vote" : "votes"} recorded.`;
    }
    if (row.sessionStatus === "pending") {
      return phaseOk
        ? "Pending. Opens when you press Open ballot."
        : "Pending. Move the cycle to Public AGM voting before this can open.";
    }
    return null;
  })();

  return (
    <article className="space-y-5 border-t border-[var(--ink-line)] pt-6 pb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span
          className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker
          primary={`Tier ${row.tier}`}
          secondary={`Ballot order ${row.order + 1}`}
        />
        <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl">
          {row.name}
        </h2>
        <div className="ml-auto">{statusBadge}</div>
      </div>

      {stateLine ? (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
          {stateLine}
        </p>
      ) : null}

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1" />
        {row.sessionStatus === "pending" && phaseOk ? (
          <Button onClick={onStart} loading={busy} size="sm">
            <Play className="h-4 w-4" aria-hidden /> Open ballot
          </Button>
        ) : null}
        {row.sessionStatus === "active" ? (
          <Button
            onClick={onClose}
            loading={busy}
            size="sm"
            variant="destructive"
          >
            <Pause className="h-4 w-4" aria-hidden /> Close ballot
          </Button>
        ) : null}
      </div>
    </article>
  );
}
