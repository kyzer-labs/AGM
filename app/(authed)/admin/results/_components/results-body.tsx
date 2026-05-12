"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { cn } from "@/lib/utils";
import { getWeights, internalSharePercent } from "@/lib/weights";
import { ActionPanel } from "./action-panel";
import { ResultArticle } from "./result-article";
import { PHASE_LABELS } from "./results-model";
import type { PreviewRow } from "./results-model";
import { ResultsPageSkeleton } from "./results-skeleton";
import { UnresolvedTiesNotice } from "./unresolved-ties-notice";

export function ResultsBody({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const rows = useQuery(api.results.adminPreview, {
    electionId: election._id,
  });
  const transition = useMutation(api.elections.transitionPhase);
  const recompute = useMutation(api.results.recompute);
  const [busy, setBusy] = useState(false);

  if (rows === undefined || adminStatus === undefined) {
    return <ResultsPageSkeleton />;
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
