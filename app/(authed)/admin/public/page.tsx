"use client";

import { useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
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

export default function AdminPublicPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined)
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
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

  if (sessions === undefined || candidates === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const candidateNameById = new Map<Id<"candidates">, string>();
  for (const c of candidates) candidateNameById.set(c._id, c.fullName);

  const phaseOk = election.phase === "publicVoting";
  const ordered = sessions.slice().sort((a, b) => a.tier - b.tier || a.order - b.order);

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Public voting" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Public voting
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Live ballot operations for <strong>{election.name}</strong>. Open
            one position at a time, watch the live count, then close it. The
            cascade is recomputed automatically as winners are decided.
          </p>
        </div>
        <Badge tone={phaseOk ? "brand" : "muted"}>
          {phaseOk ? "Public voting OPEN" : "Public voting not active"}
        </Badge>
      </header>

      {!phaseOk ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Move the cycle to publicVoting first
            </CardTitle>
            <CardDescription>
              From the{" "}
              <a className="underline" href="/admin/election">
                Election cycle
              </a>{" "}
              page, transition to <strong>Public AGM voting</strong>. Sessions
              can only be opened during that phase.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No positions configured"
          description="Add positions on the Positions page first."
        />
      ) : (
        <div className="space-y-3">
          {ordered.map((s) => (
            <SessionRowCard
              key={s.positionId}
              row={s}
              electionId={election._id}
              candidateNameById={candidateNameById}
              phaseOk={phaseOk}
              candidates={candidates}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function SessionRowCard({
  row,
  electionId,
  candidateNameById,
  phaseOk,
  candidates,
}: {
  row: SessionRow;
  electionId: Id<"elections">;
  candidateNameById: Map<Id<"candidates">, string>;
  phaseOk: boolean;
  candidates: { _id: Id<"candidates">; fullName: string; matric: string | null }[];
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const start = useMutation(api.sessions.startSession);
  const close = useMutation(api.sessions.closeSession);
  const resolveTie = useMutation(api.sessions.resolveTie);

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
          Open public voting for <strong>{row.name}</strong>. Voters will be
          able to cast votes immediately.
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
    const ok = await dialog.confirm({
      title: "Close ballot?",
      description: (
        <>
          Close voting for <strong>{row.name}</strong>. The result will be
          computed immediately and the cascade will update for the remaining
          positions.
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
          description: `Resolve manually before opening the next ballot.`,
        });
      } else {
        const winnerName = result.winnerCandidateId
          ? candidateNameById.get(result.winnerCandidateId) ?? "—"
          : "—";
        toast.success(`Closed. Winner: ${winnerName}`);
      }
    } catch (err) {
      const m = getConvexErrorMessage(err, "Failed to close.");
      toast.error("Close failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const tone = (() => {
    if (row.hasUnresolvedTie) return "warning" as const;
    if (row.sessionStatus === "active") return "brand" as const;
    if (row.sessionStatus === "closed") return "success" as const;
    return "muted" as const;
  })();

  const statusLabel = (() => {
    if (row.hasUnresolvedTie) return "Tie — resolve";
    if (row.sessionStatus === "active") return "Open";
    if (row.sessionStatus === "closed") return "Closed";
    return "Pending";
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex-1">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            Tier {row.tier} · Order {row.order + 1}
          </div>
          <CardTitle className="text-base">{row.name}</CardTitle>
        </div>
        <Badge tone={tone}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {row.sessionStatus === "pending" && cascade ? (
          <div className="rounded-md border bg-[var(--color-muted)]/40 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Cascade preview
            </div>
            <div className="mt-2 grid gap-1.5">
              <div>
                <span className="text-[var(--color-muted-foreground)]">
                  On the ballot:{" "}
                </span>
                {cascade.eligible.length === 0 ? (
                  <span className="italic">none</span>
                ) : (
                  cascade.eligible.map((c) => c.fullName).join(", ")
                )}
              </div>
              {cascade.removed.length > 0 ? (
                <div>
                  <span className="text-[var(--color-muted-foreground)]">
                    Removed by cascade:{" "}
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">
                    {cascade.removed.map((c) => c.fullName).join(", ")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {liveCounts && row.sessionStatus !== "pending" ? (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                Live counts ({liveCounts.total} votes)
              </span>
            </div>
            <ul className="grid gap-1">
              {liveCounts.counts.map((c) => {
                const pct =
                  liveCounts.total > 0 ? (c.count / liveCounts.total) * 100 : 0;
                return (
                  <li key={c.candidateId} className="grid gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{c.fullName}</span>
                      <span className="tabular-nums">
                        {c.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div
                        className="h-full bg-[var(--color-primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {row.sessionStatus === "closed" && row.winnerCandidateId ? (
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-3 text-sm">
            <Trophy className="h-4 w-4 text-[var(--color-success)]" aria-hidden />
            Winner:{" "}
            <strong>
              {candidateNameById.get(row.winnerCandidateId) ?? "—"}
            </strong>
          </div>
        ) : null}

        {row.hasUnresolvedTie ? (
          <TieResolverPanel
            positionId={row.positionId}
            candidates={candidates}
            onResolved={async (winnerId, reason) => {
              setBusy(true);
              try {
                await resolveTie({
                  positionId: row.positionId,
                  winnerCandidateId: winnerId,
                  reason,
                });
                toast.success("Tie resolved");
              } catch (err) {
                const m =
                  getConvexErrorMessage(err, "Resolve failed.");
                toast.error("Resolve failed", { description: m });
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {row.sessionStartedAt ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Opened {new Date(row.sessionStartedAt).toLocaleString()}
            </span>
          ) : null}
          {row.sessionClosedAt ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              · Closed {new Date(row.sessionClosedAt).toLocaleString()}
            </span>
          ) : null}
          <div className="flex-1" />
          {row.sessionStatus === "pending" && phaseOk ? (
            <Button onClick={onStart} loading={busy} size="sm">
              <Play className="h-4 w-4" /> Start ballot
            </Button>
          ) : null}
          {row.sessionStatus === "active" ? (
            <Button
              onClick={onClose}
              loading={busy}
              size="sm"
              variant="destructive"
            >
              <Pause className="h-4 w-4" /> Close ballot
            </Button>
          ) : null}
          {row.sessionStatus === "closed" && !row.hasUnresolvedTie ? (
            <Badge tone="muted">
              <Lock className="h-3 w-3" aria-hidden /> Closed
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TieResolverPanel({
  positionId,
  candidates,
  onResolved,
  disabled,
}: {
  positionId: Id<"positions">;
  candidates: { _id: Id<"candidates">; fullName: string }[];
  onResolved: (
    winnerId: Id<"candidates">,
    reason: string,
  ) => void | Promise<void>;
  disabled: boolean;
}) {
  const liveCounts = useQuery(api.sessions.liveCounts, { positionId });
  const [winnerId, setWinnerId] = useState<Id<"candidates"> | null>(null);
  const [reason, setReason] = useState("");

  const tieCandidates =
    liveCounts?.counts && liveCounts.counts.length > 0
      ? (() => {
          const top = liveCounts.counts[0];
          if (!top) return [];
          return liveCounts.counts.filter((c) => c.count === top.count);
        })()
      : [];

  return (
    <div className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle
          className="h-4 w-4 text-[var(--color-warning)]"
          aria-hidden
        />
        Manual tie resolution required
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        Pick the winner and provide a reason. Both are recorded in the
        immutable audit log.
      </p>
      <div className="mt-3 grid gap-2">
        {tieCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tieCandidates.map((tc) => (
              <button
                key={tc.candidateId}
                type="button"
                onClick={() =>
                  setWinnerId(tc.candidateId as Id<"candidates">)
                }
                className={
                  winnerId === tc.candidateId
                    ? "rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary-foreground)]"
                    : "rounded-full border px-3 py-1 text-xs hover:bg-[var(--color-muted)]"
                }
              >
                <CheckCircle2
                  className="mr-1 inline h-3 w-3"
                  aria-hidden
                />
                {candidates.find((c) => c._id === tc.candidateId)?.fullName ??
                  "Unknown"}{" "}
                · {tc.count}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          rows={2}
          placeholder="Reason for this manual decision (logged)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-md border bg-[var(--color-background)] px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (!winnerId) {
                toast.error("Pick a winner first.");
                return;
              }
              if (reason.trim().length < 3) {
                toast.error("Provide a reason for the audit log.");
                return;
              }
              void onResolved(winnerId, reason.trim());
            }}
            disabled={disabled}
          >
            Resolve tie
          </Button>
        </div>
      </div>
    </div>
  );
}
