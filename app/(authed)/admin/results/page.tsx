"use client";

import Link from "next/link";
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
  UserCircle2,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";

import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getWeights, internalSharePercent } from "@/lib/weights";
import type { Doc, Id } from "@/convex/_generated/dataModel";

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
  if (election === undefined) return <PageSkeleton />;
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
    return <PageSkeleton />;
  }

  const isSuper = adminStatus?.role === "super";
  const inPublicVoting = election.phase === "publicVoting";
  const inPreview = election.phase === "resultsPreview";
  const isPublished = election.phase === "published";

  const internalShare = internalSharePercent(getWeights(election));
  const publicShare = Math.max(0, 100 - internalShare);

  const allWithResults = rows.filter((r) => r.state !== null);
  const unresolvedTies = rows.filter((r) => r.hasUnresolvedTie);
  const publishedCount = rows.filter((r) => r.state === "published").length;

  const onMoveToPreview = async () => {
    const ok = await dialog.confirm({
      title: "Move to results preview?",
      description: (
        <>
          Locks the cycle into admin-only review mode. Every ballot must
          already be closed and every tie resolved. After preview lock you
          can review the per-position breakdown one more time, then publish.
        </>
      ),
      confirmText: "Move to preview",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await transition({
        electionId: election._id,
        toPhase: "resultsPreview",
      });
      toast.success("Moved to results preview");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Transition failed.");
      toast.error("Transition failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    const ok = await dialog.confirm({
      title: "Publish results to all voters?",
      description: (
        <>
          Reveals every winner on the public results page and locks the
          cycle into the{" "}
          <strong className="font-semibold">published</strong> phase.
          Publishing covers{" "}
          <strong className="font-semibold tabular-nums">
            {allWithResults.length}{" "}
            {allWithResults.length === 1 ? "position" : "positions"}
          </strong>
          . Once published, the cycle is terminal and the results page
          cannot be unpublished.
        </>
      ),
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
      confirmText: "Publish",
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
      const m = getConvexErrorMessage(err, "Publish failed.");
      toast.error("Publish failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onRecompute = async (row: PreviewRow) => {
    const reason = await dialog.prompt({
      title: "Recompute this position?",
      description: (
        <>
          Recomputes the result for{" "}
          <strong className="font-semibold">{row.positionName}</strong>. The
          previous winner is excluded from cascade exclusions during
          recomputation. Both the recompute and the new winner are written
          to the audit log.
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
      const m = getConvexErrorMessage(err, "Recompute failed.");
      toast.error("Recompute failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Results & publishing" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Results and publishing"
          secondary={election.name}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Combined breakdown and publish gate
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Combined internal ({internalShare}%) and public ({publicShare}%)
          scoring for{" "}
          <strong className="font-semibold text-[var(--ink)]">
            {election.name}
          </strong>
          , normalised by the configured class weights. Review every
          position before publishing. Publishing is final; once you publish,
          voters see results on{" "}
          <Link
            href="/results"
            className="underline decoration-[var(--copper)] underline-offset-4 hover:text-[var(--ink)]"
          >
            the results page
          </Link>
          .
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
                    isPublished
                      ? "bg-[var(--teal)]"
                      : inPreview
                        ? "bg-[var(--copper)]"
                        : "bg-[var(--ink-muted)]",
                  )}
                />
                {PHASE_LABELS[election.phase] ?? election.phase}
              </span>
            }
          />
          <Meta label="Positions with results" value={allWithResults.length} />
          <Meta
            label="Unresolved ties"
            value={
              unresolvedTies.length > 0 ? (
                <span className="text-[var(--copper)]">
                  {unresolvedTies.length}
                </span>
              ) : (
                0
              )
            }
          />
          <Meta label="Published" value={publishedCount} />
        </MetaGroup>
      </header>

      {inPublicVoting ? (
        <ActionPanel
          markerPrimary="Phase transition"
          markerSecondary="Required before publishing"
          title="Move to results preview"
          body="Once every ballot is closed and any ties are resolved, switch the cycle into Results preview to lock data in before publishing."
        >
          <Button onClick={onMoveToPreview} loading={busy}>
            Move to results preview
          </Button>
        </ActionPanel>
      ) : null}

      {unresolvedTies.length > 0 ? (
        <UnresolvedTiesNotice rows={unresolvedTies} />
      ) : null}

      {inPreview && unresolvedTies.length === 0 && allWithResults.length > 0 ? (
        <ActionPanel
          markerPrimary="Publish gate"
          markerSecondary="Irreversible"
          title="Publish results"
          body={`Publishing covers ${allWithResults.length} ${allWithResults.length === 1 ? "position" : "positions"}, makes the public results page visible to every voter, and flips the cycle to its terminal published phase. The cycle cannot be unpublished.`}
        >
          <Button onClick={onPublish} loading={busy} variant="destructive">
            <Upload className="h-4 w-4" aria-hidden /> Publish all results
          </Button>
        </ActionPanel>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No positions configured"
          description="Configure the AGM ballot before any results can be computed."
          action={
            <LinkButton href="/admin/positions">
              Configure positions
            </LinkButton>
          }
        />
      ) : (
        <ol className="space-y-0" aria-label="Results by position">
          {rows.map((row, index) => (
            <li key={row.positionId}>
              <ResultArticle
                row={row}
                index={index}
                isSuper={isSuper}
                busy={busy}
                onRecompute={() => onRecompute(row)}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function ActionPanel({
  markerPrimary,
  markerSecondary,
  title,
  body,
  children,
}: {
  markerPrimary: string;
  markerSecondary?: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <NoticeStrip
      markerPrimary={markerPrimary}
      markerSecondary={markerSecondary}
      headline={title}
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {body}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </NoticeStrip>
  );
}

function UnresolvedTiesNotice({ rows }: { rows: PreviewRow[] }) {
  return (
    <NoticeStrip
      markerPrimary="Unresolved ties"
      markerSecondary="Blocking publish"
      markerIcon={
        <AlertTriangle
          className="h-4 w-4 text-[var(--copper)]"
          aria-hidden
        />
      }
      headline="Resolve every tie before publishing"
      role="alert"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        These positions need a manual decision before results can be
        published. Resolve each one on the{" "}
        <Link
          href="/admin/public"
          className="underline decoration-[var(--copper)] underline-offset-4 hover:text-[var(--ink)]"
        >
          Public voting
        </Link>{" "}
        page.
      </p>
      <ul className="font-mono text-sm tabular-nums text-[var(--ink)]">
        {rows.map((r) => (
          <li key={r.positionId} className="flex gap-3 py-1">
            <span className="text-[var(--ink-muted)]">·</span>
            <span>
              Tier {r.tier} · {r.positionName}
            </span>
          </li>
        ))}
      </ul>
    </NoticeStrip>
  );
}

function ResultArticle({
  row,
  index,
  isSuper,
  busy,
  onRecompute,
}: {
  row: PreviewRow;
  index: number;
  isSuper: boolean;
  busy: boolean;
  onRecompute: () => void;
}) {
  const stateBadge = (() => {
    if (row.hasUnresolvedTie) {
      return (
        <Badge tone="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Tie unresolved
        </Badge>
      );
    }
    if (row.state === "published") {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Published
        </Badge>
      );
    }
    if (row.state === "manualTieResolved") {
      return (
        <Badge tone="brand">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Manually resolved
        </Badge>
      );
    }
    if (row.state === "previewed") {
      return (
        <Badge tone="brand">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Computed
        </Badge>
      );
    }
    return <Badge tone="muted">Not computed yet</Badge>;
  })();

  const tieBreakLabel =
    row.tieBreakStep && row.tieBreakStep !== "finalScore"
      ? (TIE_STEP_LABELS[row.tieBreakStep] ?? row.tieBreakStep)
      : null;

  const winner =
    row.breakdown.find((b) => b.candidateId === row.winnerCandidateId) ??
    null;

  const internalShare = internalSharePercent(row.weights);
  const publicShare = Math.max(0, 100 - internalShare);

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
          {row.positionName}
        </h2>
        <div className="ml-auto">{stateBadge}</div>
      </div>

      {winner ? (
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-muted)]">
            {winner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winner.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle2
                className="h-6 w-6 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-base font-semibold text-[var(--ink)] sm:text-lg">
              <Trophy
                className="h-4 w-4 text-[var(--teal)]"
                aria-label="Winner"
              />
              {winner.fullName}
            </p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {winner.matric && !winner.matric.startsWith("auto-")
                ? `${winner.matric} · `
                : ""}
              Final score {(winner.finalScore * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No winner recorded for this position yet.
        </p>
      )}

      {tieBreakLabel || row.manualResolutionReason ? (
        <div className="space-y-1">
          {tieBreakLabel ? (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--copper)] tabular-nums">
              Tie broken by: {tieBreakLabel}
            </p>
          ) : null}
          {row.manualResolutionReason ? (
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Manual decision:{" "}
              </span>
              {row.manualResolutionReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {row.breakdown.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No breakdown yet. This position has not been closed.
        </p>
      ) : (
        <BreakdownTable
          row={row}
          internalShare={internalShare}
          publicShare={publicShare}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ink-line)] pt-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] tabular-nums">
          {row.totalPublicVotes} total public{" "}
          {row.totalPublicVotes === 1 ? "vote" : "votes"}
          {row.publishedAt ? (
            <>
              {" · "}Published {formatMYT(row.publishedAt)}
            </>
          ) : null}
        </p>
        {isSuper && row.state ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecompute}
            disabled={busy}
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden /> Recompute
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function BreakdownTable({
  row,
  internalShare,
  publicShare,
}: {
  row: PreviewRow;
  internalShare: number;
  publicShare: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Per-candidate breakdown for {row.positionName}. Internal share is{" "}
          {internalShare}%, public share is {publicShare}%.
        </caption>
        <thead>
          <tr className="border-b border-[var(--ink-line)] text-left">
            <th
              scope="col"
              className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
              Candidate
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              TC ({row.weights.topCommittee}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              HE ({row.weights.headExecutive}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              Y2 ({row.weights.year2Committee}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] tabular-nums"
            >
              Public ({row.weights.public}%)
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
              Internal agg
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
            >
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
                className={cn(
                  "border-b border-[var(--ink-line)] last:border-b-0",
                  isWinner ? "bg-[var(--color-success)]/10" : null,
                )}
              >
                <th
                  scope="row"
                  className="px-2 py-2 text-left font-normal align-top"
                >
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
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink)]">
                        <span className="truncate">{b.fullName}</span>
                        {isWinner ? (
                          <Trophy
                            className="h-3.5 w-3.5 shrink-0 text-[var(--teal)]"
                            aria-label="Winner"
                          />
                        ) : null}
                      </div>
                      {b.matric && !b.matric.startsWith("auto-") ? (
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                          {b.matric}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </th>
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
                  {b.publicVotes} ({(b.publicShare * 100).toFixed(1)}%)
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
