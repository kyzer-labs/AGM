"use client";

import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/components/dialog/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionMarker } from "@/components/ui/section-marker";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import type { CandidateRef, SessionRow } from "./public-model";

export function TieResolverDialog({
  row,
  candidates,
  candidateNameById,
  onClose,
}: {
  row: SessionRow;
  candidates: CandidateRef[];
  candidateNameById: Map<Id<"candidates">, string>;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const resolveTie = useMutation(api.sessions.resolveTie);
  const liveCounts = useQuery(api.sessions.liveCounts, {
    positionId: row.positionId,
  });
  const [winnerId, setWinnerId] = useState<Id<"candidates"> | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tieGroup =
    liveCounts?.counts && liveCounts.counts.length > 0
      ? (() => {
          const top = liveCounts.counts[0];
          if (!top) return [];
          return liveCounts.counts.filter((c) => c.count === top.count);
        })()
      : [];

  const tieCount = tieGroup[0]?.count ?? 0;

  const onSubmit = async () => {
    if (!winnerId) {
      toast.error("Pick a winner first.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Provide a reason for the audit log.");
      return;
    }
    setSubmitting(true);
    try {
      await resolveTie({
        positionId: row.positionId,
        winnerCandidateId: winnerId,
        reason: reason.trim(),
      });
      toast.success("Tie resolved");
      onClose();
    } catch (err) {
      const m = getConvexErrorMessage(err, "Resolve failed.");
      toast.error("Resolve failed", { description: m });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
      labelledBy={titleId}
      describedBy={descriptionId}
      size="lg"
    >
      <DialogHeader>
        <SectionMarker primary={`Tier ${row.tier}`} secondary={row.name} />
        <DialogTitle id={titleId}>Resolve tie manually</DialogTitle>
        <DialogDescription id={descriptionId}>
          Both choices are written to the immutable audit log and cannot be
          revised. The full tiebreak ladder reached a manual decision because
          every automated step (final score, class shares, public share) was
          tied.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
            Tied candidates
            {tieGroup.length > 0 ? (
              <>
                {" · "}
                {tieCount} {tieCount === 1 ? "vote" : "votes"} each
              </>
            ) : null}
          </legend>
          {tieGroup.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              Loading tie group…
            </p>
          ) : (
            <ul className="space-y-1">
              {tieGroup.map((tc) => {
                const id = tc.candidateId as Id<"candidates">;
                const checked = winnerId === id;
                const fullName =
                  candidateNameById.get(id) ??
                  candidates.find((c) => c._id === id)?.fullName ??
                  "Unknown";
                return (
                  <li key={tc.candidateId}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
                        checked
                          ? "border-[var(--ink)] bg-[var(--paper-2)]"
                          : "border-[var(--ink-line)] hover:border-[var(--ink)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="tie-winner"
                        value={tc.candidateId}
                        checked={checked}
                        onChange={() => setWinnerId(id)}
                        disabled={submitting}
                        className="h-4 w-4 accent-[var(--teal)]"
                      />
                      <span className="flex-1 font-medium text-[var(--ink)]">
                        {fullName}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                        {tc.count} votes
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="tie-reason">Reason (logged)</Label>
          <Textarea
            id="tie-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. coin toss in the presence of the chairperson and both candidates"
            rows={3}
            disabled={submitting}
            required
          />
          <p className="text-xs text-[var(--ink-muted)]">
            At least 3 characters. Written verbatim into the audit log.
          </p>
        </div>

        <p
          className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--color-destructive)]"
          role="status"
        >
          This finalizes the winner for {row.name}
        </p>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onSubmit}
          loading={submitting}
        >
          Resolve tie
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}
