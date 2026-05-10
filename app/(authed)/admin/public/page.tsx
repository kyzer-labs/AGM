"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Lock,
  Pause,
  Play,
  Trophy,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/components/dialog/dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYTTimeOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface SessionRow {
  positionId: Id<"positions">;
  name: string;
  tier: number;
  order: number;
  sessionStatus: "pending" | "active" | "closed";
  sessionStartedAt: number | null;
  sessionClosedAt: number | null;
  voteCount: number;
  resultState: "previewed" | "published" | "manualTieResolved" | null;
  winnerCandidateId: Id<"candidates"> | null;
  hasUnresolvedTie: boolean;
}

interface CandidateRef {
  _id: Id<"candidates">;
  fullName: string;
  matric: string | null;
}

export default function AdminPublicPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <PageSkeleton />;
  if (election === null) return <NoElection />;
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const sessions = useQuery(api.sessions.listSessionStatuses, {
    electionId: election._id,
  });
  const candidates = useQuery(api.candidates.list, {
    electionId: election._id,
  });

  const [tieRow, setTieRow] = useState<SessionRow | null>(null);

  if (sessions === undefined || candidates === undefined) {
    return <PageSkeleton />;
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

function PhaseMismatchNotice() {
  return (
    <NoticeStrip
      markerPrimary="Phase mismatch"
      markerSecondary="Action required"
      headline="Move the cycle to public voting first"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        Sessions can only be opened during the{" "}
        <strong className="font-semibold text-[var(--ink)]">
          Public AGM voting
        </strong>{" "}
        phase. Transition the cycle from the{" "}
        <Link
          href="/admin/election"
          className="underline decoration-[var(--copper)] underline-offset-4 hover:text-[var(--ink)]"
        >
          Election cycle
        </Link>{" "}
        page.
      </p>
    </NoticeStrip>
  );
}

function SessionRowItem({
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

function CascadePreview({
  cascade,
}: {
  cascade: {
    eligible: { fullName: string }[];
    removed: { fullName: string }[];
  };
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] px-4 py-3">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Cascade preview
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--ink)]">
        <span className="text-[var(--ink-muted)]">On the ballot: </span>
        {cascade.eligible.length === 0 ? (
          <span className="italic text-[var(--ink-muted)]">none</span>
        ) : (
          cascade.eligible.map((c) => c.fullName).join(", ")
        )}
      </p>
      {cascade.removed.length > 0 ? (
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          <span className="text-[var(--ink-muted)]">Removed by cascade: </span>
          {cascade.removed.map((c) => c.fullName).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function LiveCounts({
  counts,
  total,
  highlightWinnerId,
}: {
  counts: { candidateId: string; fullName: string; count: number }[];
  total: number;
  highlightWinnerId: Id<"candidates"> | null;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
        Live count · {total} {total === 1 ? "vote" : "votes"}
      </p>
      <ul className="space-y-2">
        {counts.map((c) => {
          const pct = total > 0 ? (c.count / total) * 100 : 0;
          const isWinner =
            highlightWinnerId !== null &&
            (c.candidateId as Id<"candidates">) === highlightWinnerId;
          return (
            <li key={c.candidateId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "truncate",
                    isWinner
                      ? "font-semibold text-[var(--ink)]"
                      : "text-[var(--ink)]",
                  )}
                >
                  {isWinner ? (
                    <Trophy
                      className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-[var(--teal)]"
                      aria-label="Winner"
                    />
                  ) : null}
                  {c.fullName}
                </span>
                <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                  <span className="text-[var(--ink)]">{c.count}</span>
                  {total > 0 ? <span> · {pct.toFixed(0)}%</span> : null}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]"
                role="presentation"
              >
                <div
                  className="h-full bg-[var(--teal)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WinnerStrip({ name }: { name: string }) {
  return (
    <div
      className="flex items-center gap-2 border-t border-[var(--ink-line)] pt-3"
      role="status"
    >
      <Trophy className="h-4 w-4 text-[var(--teal)]" aria-label="Winner" />
      <p className="text-sm">
        <span className="text-[var(--ink-muted)]">Winner: </span>
        <strong className="font-semibold text-[var(--ink)]">{name}</strong>
      </p>
    </div>
  );
}

function UnresolvedTieStrip({ onResolve }: { onResolve: () => void }) {
  return (
    <div
      className="flex flex-col gap-3 border-y border-[var(--copper)] bg-[var(--paper-2)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
      role="alert"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--copper)]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Manual tie resolution required
        </div>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--ink)]">
          The automatic tiebreak ladder reached a manual decision. Pick the
          winner and write a reason for the audit log before opening the next
          ballot.
        </p>
      </div>
      <Button onClick={onResolve} variant="destructive" size="sm">
        Resolve tie
      </Button>
    </div>
  );
}

function TieResolverDialog({
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
