"use client";

import { useMemo } from "react";
import { Pencil, Trash2, Users } from "lucide-react";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CandidateRow } from "./candidates-model";

export function CandidateCard({
  c,
  editable,
  onEdit,
  onRemove,
}: {
  c: CandidateRow;
  editable: boolean;
  onEdit: () => void;
  onRemove: () => void;
  index: number;
}) {
  const sortedPositions = useMemo(
    () =>
      c.positions.slice().sort((a, b) => a.fallbackOrder - b.fallbackOrder),
    [c.positions],
  );

  return (
    <Card className="rounded-md">
      <CardContent className="flex gap-4 p-4">
        <div className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--paper)] ring-1 ring-[var(--ink-line)]">
          <CandidatePhoto
            src={c.photoUrl}
            className="h-full w-full object-contain"
            iconClassName="h-8 w-8"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[0.6875rem] uppercase leading-[1.2] tracking-[0.14em] text-[var(--ink-muted)]">
                {c.matric && !c.matric.startsWith("auto-")
                  ? c.matric
                  : "Candidate"}
              </p>
              <h3 className="mt-1 truncate font-serif text-lg font-semibold leading-[1.08] text-[var(--ink)]">
                {c.fullName}
              </h3>
            </div>
            {editable ? (
              <div className="flex items-center">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label={`Edit ${c.fullName}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRemove}
                  aria-label={`Delete ${c.fullName}`}
                >
                  <Trash2
                    className="h-4 w-4 text-[var(--color-destructive)]"
                    aria-hidden
                  />
                </Button>
              </div>
            ) : null}
          </div>
          {sortedPositions.length > 0 ? (
            <ol
              className="mt-3.5 grid gap-1.5"
              aria-label="Contending positions"
            >
              {sortedPositions.map((p, i) => (
                <li
                  key={p.positionId}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span className="font-mono text-[0.6875rem] leading-[1.2] tabular-nums text-[var(--ink-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-[0.8125rem] leading-[1.2] text-[var(--ink-muted)]">
                    {p.name}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p
              className="mt-2 inline-flex items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--copper)]"
              role="status"
            >
              <Users className="h-3 w-3" aria-hidden /> No positions
              assigned
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
