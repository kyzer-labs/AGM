"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Lock, Pencil, Trash2 } from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { TIER_LABELS } from "./positions-model";

export function PositionRow({
  position,
  ordinal,
  tierOrdinal,
  tierTotal,
  isFirst,
  isLast,
  locked,
  onEdit,
  onMove,
  onConfirmedRemove,
}: {
  position: Doc<"positions">;
  ordinal: number;
  tierOrdinal: number;
  tierTotal: number;
  isFirst: boolean;
  isLast: boolean;
  locked: boolean;
  index: number;
  onEdit: () => void;
  onMove: (direction: "up" | "down") => void | Promise<void>;
  onConfirmedRemove: () => Promise<void>;
}) {
  const dialog = useDialog();
  const impact = useQuery(api.positions.positionImpact, {
    positionId: position._id,
  });

  const onRemove = async () => {
    if (impact === undefined) return;

    const candidateCount = impact?.candidateCount ?? 0;
    const voteCount = impact?.voteCount ?? 0;

    let description: ReactNode;
    if (candidateCount === 0 && voteCount === 0) {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{position.name}</strong>. No
          candidates list it and no votes reference it, so nothing else
          changes. The action cannot be undone.
        </>
      );
    } else {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{position.name}</strong>. This
          unassigns it from{" "}
          <strong className="font-semibold tabular-nums">
            {candidateCount}
          </strong>{" "}
          {candidateCount === 1 ? "candidate" : "candidates"}
          {voteCount > 0 ? (
            <>
              {" "}and discards{" "}
              <strong className="font-semibold tabular-nums">
                {voteCount}
              </strong>{" "}
              {voteCount === 1 ? "vote" : "votes"} already cast on it
            </>
          ) : null}
          . The action cannot be undone.
        </>
      );
    }

    const ok = await dialog.confirm({
      title: "Delete this position?",
      description,
      confirmText: "Delete position",
      variant: "destructive",
    });
    if (!ok) return;
    await onConfirmedRemove();
  };

  return (
    <li
      className="flex min-h-32 flex-col justify-between rounded-md border bg-[var(--color-card)] p-4 text-sm text-[var(--color-card-foreground)] shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--color-secondary)] font-mono text-sm tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(ordinal).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.6875rem] uppercase leading-[1.2] tracking-[0.14em] text-[var(--ink-muted)]">
            Tier {position.tier} · {TIER_LABELS[position.tier] ?? "Other"}
          </p>
          <h3 className="mt-1 truncate font-serif text-lg font-semibold leading-[1.08] text-[var(--ink)]">
            {position.name}
          </h3>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ink-line)] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
            Tier order {tierOrdinal}/{tierTotal}
          </span>
          {impact !== undefined &&
          impact !== null &&
          impact.candidateCount > 0 ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
              {impact.candidateCount}{" "}
              {impact.candidateCount === 1 ? "candidate" : "candidates"}
            </span>
          ) : null}
        </div>
        {!locked ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={isFirst}
              onClick={() => void onMove("up")}
              aria-label={`Move ${position.name} up`}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isLast}
              onClick={() => void onMove("down")}
              aria-label={`Move ${position.name} down`}
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label={`Delete ${position.name}`}
            >
              <Trash2
                className="h-4 w-4 text-[var(--color-destructive)]"
                aria-hidden
              />
            </Button>
          </div>
        ) : (
          <Badge tone="muted">
            <Lock className="h-3 w-3" aria-hidden /> Locked
          </Badge>
        )}
      </div>
    </li>
  );
}
