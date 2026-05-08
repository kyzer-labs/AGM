"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Trophy,
  Upload,
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";

const PHASE_LABELS: Record<string, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation",
  internalClosed: "Internal closed",
  publicVoting: "Public voting",
  resultsPreview: "Results preview",
  published: "Published",
};

interface PreviewBreakdown {
  candidateId: Id<"candidates">;
  fullName: string;
  matric: string;
  photoUrl: string | null;
  tcShare: number;
  heShare: number;
  y2Share: number;
  publicVotes: number;
  publicShare: number;
  internalAggregate: number;
  publicAggregate: number;
  finalScore: number;
}

interface PreviewRow {
  positionId: Id<"positions">;
  positionName: string;
  tier: number;
  order: number;
  state: "previewed" | "published" | "manualTieResolved" | null;
  winnerCandidateId: Id<"candidates"> | null;
  winnerName: string | null;
  hasUnresolvedTie: boolean;
  tieBreakStep: string | null;
  manualResolutionReason: string | null;
  publishedAt: number | null;
  totalPublicVotes: number;
  weights: {
    topCommittee: number;
    headExecutive: number;
    year2Committee: number;
    public: number;
  };
  breakdown: PreviewBreakdown[];
}

const TIE_STEP_LABELS: Record<string, string> = {
  finalScore: "Final score",
  tcShare: "Top Committee share",
  heShare: "Head Executive share",
  y2Share: "Year 2 Committee share",
  publicShare: "Public vote share",
  internalShare: "Internal share (legacy)",
  manual: "Manual decision",
};

export default function AdminResultsPage() {
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
  const dialog = useDialog();
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const rows = useQuery(api.results.adminPreview, {
    electionId: election._id,
  });
  const transition = useMutation(api.elections.transitionPhase);
  const recompute = useMutation(api.results.recompute);
  const [busy, setBusy] = useState(false);

  if (rows === undefined || adminStatus === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const isSuper = adminStatus?.role === "super";
  const inPreview = election.phase === "resultsPreview";
  const isPublished = election.phase === "published";

  const allWithResults = rows.filter((r) => r.state !== null);
  const unresolvedTies = rows.filter((r) => r.hasUnresolvedTie);

  const onMoveToPreview = async () => {
    const ok = await dialog.confirm({
      title: "Move to Results preview?",
      description:
        "Every ballot must already be closed and every tie resolved. The cycle will lock in admin-only review mode.",
      confirmText: "Move to preview",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await transition({
        electionId: election._id,
        toPhase: "resultsPreview",
      });
      toast.success("Moved to Results preview");
    } catch (err) {
      const m = friendlyError(err, "Transition failed.");
      toast.error("Transition failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    const ok = await dialog.confirm({
      title: "Publish results to all voters?",
      description:
        "This is the final reveal. Make sure every position has a confirmed winner. Once published, the cycle becomes terminal.",
      confirmText: "Publish results",
      variant: "destructive",
    });
    if (!ok) return;
    const reason = await dialog.prompt({
      title: "Optional audit note",
      description:
        "Add a short note for the audit log (e.g. chairperson approved). Leave blank to skip.",
      label: "Audit note",
      placeholder: "Approved by chairperson on AGM day",
      multiline: true,
    });
    setBusy(true);
    try {
      await transition({
        electionId: election._id,
        toPhase: "published",
        reason: reason && reason.trim().length > 0 ? reason : undefined,
      });
      toast.success("Results published");
    } catch (err) {
      const m = friendlyError(err, "Publish failed.");
      toast.error("Publish failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRecompute = async (row: PreviewRow) => {
    const reason = await dialog.prompt({
      title: "Recompute position?",
      description: (
        <>
          Recompute the result for <strong>{row.positionName}</strong>. The
          previous winner is excluded from cascade exclusions during the
          recomputation.
        </>
      ),
      label: "Reason (required, written to audit log)",
      placeholder: "e.g. internal scoring corrected by admin",
      required: true,
      validate: (v) =>
        v.trim().length < 3 ? "Reason must be at least 3 characters" : null,
      confirmText: "Recompute",
      variant: "destructive",
    });
    if (!reason) return;
    setBusy(true);
    try {
      await recompute({ positionId: row.positionId, reason: reason.trim() });
      toast.success("Recomputed");
    } catch (err) {
      const m = friendlyError(err, "Recompute failed.");
      toast.error("Recompute failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Results & publishing" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Results &amp; publishing
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Combined internal (60%) + public (40%) scoring for{" "}
            <strong>{election.name}</strong>, normalised by the configured
            class weights. Review every position before publishing — once
            you publish, voters can see results on{" "}
            <a className="underline" href="/results">
              the results page
            </a>
            .
          </p>
        </div>
        <Badge tone={isPublished ? "success" : inPreview ? "warning" : "muted"}>
          {PHASE_LABELS[election.phase] ?? election.phase}
        </Badge>
      </header>

      {election.phase === "publicVoting" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Move to Results preview
            </CardTitle>
            <CardDescription>
              Once every ballot is closed and any ties are resolved, switch
              the cycle into <strong>Results preview</strong> to lock data
              in before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onMoveToPreview} loading={busy}>
              Move to Results preview
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {unresolvedTies.length > 0 ? (
        <Card className="border-[var(--color-warning)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4 text-[var(--color-warning)]"
                aria-hidden
              />
              Unresolved ties
            </CardTitle>
            <CardDescription>
              Resolve ties on the{" "}
              <a className="underline" href="/admin/public">
                Public voting page
              </a>{" "}
              before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm">
              {unresolvedTies.map((r) => (
                <li key={r.positionId}>{r.positionName}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {inPreview && unresolvedTies.length === 0 && allWithResults.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publish results</CardTitle>
            <CardDescription>
              Publishing makes the results page visible to all voters and
              flips the cycle to its final, terminal phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onPublish} loading={busy}>
              <Upload className="h-4 w-4" /> Publish all results
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No positions configured"
          description="Add positions on the Positions page first."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ResultCard
              key={row.positionId}
              row={row}
              isSuper={isSuper}
              busy={busy}
              onRecompute={() => onRecompute(row)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ResultCard({
  row,
  isSuper,
  busy,
  onRecompute,
}: {
  row: PreviewRow;
  isSuper: boolean;
  busy: boolean;
  onRecompute: () => void;
}) {
  const stateBadge = (() => {
    if (row.hasUnresolvedTie)
      return (
        <Badge tone="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Tie unresolved
        </Badge>
      );
    if (row.state === "published")
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Published
        </Badge>
      );
    if (row.state === "manualTieResolved")
      return <Badge tone="brand">Manually resolved</Badge>;
    if (row.state === "previewed") return <Badge tone="brand">Computed</Badge>;
    return <Badge tone="muted">Not computed yet</Badge>;
  })();

  const tieBreakLabel =
    row.tieBreakStep && row.tieBreakStep !== "finalScore"
      ? (TIE_STEP_LABELS[row.tieBreakStep] ?? row.tieBreakStep)
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex-1">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            Tier {row.tier} · Order {row.order + 1}
          </div>
          <CardTitle className="text-base">{row.positionName}</CardTitle>
          {row.winnerName ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <Trophy
                className="h-4 w-4 text-[var(--color-success)]"
                aria-hidden
              />
              <strong>{row.winnerName}</strong>
            </p>
          ) : null}
          {row.manualResolutionReason ? (
            <p className="mt-1 text-xs italic text-[var(--color-muted-foreground)]">
              Manual decision: {row.manualResolutionReason}
            </p>
          ) : null}
          {tieBreakLabel ? (
            <p className="mt-1 text-xs text-[var(--color-warning)]">
              Tie broken by: {tieBreakLabel}
            </p>
          ) : null}
        </div>
        {stateBadge}
      </CardHeader>
      <CardContent className="space-y-3">
        {row.breakdown.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            No breakdown yet — this position hasn&apos;t been closed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--color-muted-foreground)]">
                  <th className="px-2 py-1.5 font-medium">Candidate</th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    TC ({row.weights.topCommittee}%)
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    HE ({row.weights.headExecutive}%)
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Y2 ({row.weights.year2Committee}%)
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Public ({row.weights.public}%)
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Internal agg
                  </th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Final
                  </th>
                </tr>
              </thead>
              <tbody>
                {row.breakdown.map((b) => {
                  const isWinner = b.candidateId === row.winnerCandidateId;
                  return (
                    <tr
                      key={b.candidateId}
                      className={
                        isWinner
                          ? "bg-[var(--color-success)]/10"
                          : "border-b last:border-b-0"
                      }
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          {b.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={b.photoUrl}
                              alt=""
                              className="h-7 w-7 rounded object-cover"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded bg-[var(--color-muted)]" />
                          )}
                          <div>
                            <div className="text-sm font-medium">
                              {b.fullName}
                              {isWinner ? (
                                <span className="ml-2 text-[var(--color-success)]">
                                  ★
                                </span>
                              ) : null}
                            </div>
                            {b.matric && !b.matric.startsWith("auto-") ? (
                              <div className="text-xs text-[var(--color-muted-foreground)]">
                                {b.matric}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(b.tcShare * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(b.heShare * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(b.y2Share * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {b.publicVotes} (
                        {(b.publicShare * 100).toFixed(1)}%)
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(b.internalAggregate * 100).toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">
                        {(b.finalScore * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {row.totalPublicVotes} total public votes
            {row.publishedAt
              ? ` · published ${new Date(row.publishedAt).toLocaleString()}`
              : ""}
          </span>
          {isSuper && row.state ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRecompute}
              disabled={busy}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Recompute
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
