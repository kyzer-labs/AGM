"use client";

import { useState } from "react";
import { useQuery } from "convex/react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PhaseMismatchNotice } from "./phase-mismatch-notice";
import { PublicPageSkeleton } from "./public-skeleton";
import type { SessionRow } from "./public-model";
import { SessionRowItem } from "./session-row-item";
import { TieResolverDialog } from "./tie-resolver-dialog";

export function PublicBody({ election }: { election: Doc<"elections"> }) {
  const sessions = useQuery(api.sessions.listSessionStatuses, {
    electionId: election._id,
  });
  const candidates = useQuery(api.candidates.list, {
    electionId: election._id,
  });

  const [tieRow, setTieRow] = useState<SessionRow | null>(null);

  if (sessions === undefined || candidates === undefined) {
    return <PublicPageSkeleton />;
  }

  const candidateNameById = new Map<Id<"candidates">, string>();
  for (const c of candidates) candidateNameById.set(c._id, c.fullName);

  const phaseOk = election.phase === "publicVoting";
  const ordered = sessions
    .slice()
    .sort((a, b) => a.tier - b.tier || a.order - b.order);

  const counts = {
    pending: ordered.filter((s) => s.sessionStatus === "pending").length,
    active: ordered.filter((s) => s.sessionStatus === "active").length,
    closed: ordered.filter((s) => s.sessionStatus === "closed").length,
    unresolved: ordered.filter((s) => s.hasUnresolvedTie).length,
  };

  return (
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Public voting" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Live AGM voting"
          secondary={election.name}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Public ballot operations
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Open one position at a time, watch the live count, then close the
          ballot. The cascade recomputes automatically as winners are decided.
          Closing a ballot is final; tied positions stay paused until you
          resolve them manually.
        </p>
        <MetaGroup className="sm:grid-cols-2 lg:grid-cols-4">
          <Meta
            label="Cycle phase"
            value={
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    phaseOk
                      ? "bg-[var(--teal)]"
                      : "bg-[var(--ink-muted)]",
                  )}
                />
                {phaseOk ? "Public voting open" : "Public voting not active"}
              </span>
            }
          />
          <Meta label="Pending" value={counts.pending} />
          <Meta label="Open right now" value={counts.active} />
          <Meta
            label="Closed"
            value={
              counts.unresolved > 0 ? (
                <span>
                  {counts.closed}
                  <span className="ml-2 text-[var(--ink-muted)]">
                    · {counts.unresolved} unresolved
                  </span>
                </span>
              ) : (
                counts.closed
              )
            }
          />
        </MetaGroup>
      </header>

      {!phaseOk ? (
        <PhaseMismatchNotice />
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No positions configured"
          description="Configure the AGM ballot before any position can be opened."
          action={
            <LinkButton href="/admin/positions">
              Configure positions
            </LinkButton>
          }
        />
      ) : (
        <ol className="space-y-0" aria-label="Positions">
          {ordered.map((row, index) => (
            <li key={row.positionId}>
              <SessionRowItem
                row={row}
                index={index}
                electionId={election._id}
                candidateNameById={candidateNameById}
                phaseOk={phaseOk}
                onResolveTie={() => setTieRow(row)}
              />
            </li>
          ))}
        </ol>
      )}

      {tieRow ? (
        <TieResolverDialog
          row={tieRow}
          candidates={candidates}
          candidateNameById={candidateNameById}
          onClose={() => setTieRow(null)}
        />
      ) : null}
    </main>
  );
}
