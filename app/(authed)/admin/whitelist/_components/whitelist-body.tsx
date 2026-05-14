"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Upload,
  Users2,
} from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { getPageSizeForMediaHeight } from "@/lib/viewport-pagination";
import type { Doc } from "@/convex/_generated/dataModel";
import { AddSingleModal } from "./add-single-modal";
import { BulkImportModal } from "./bulk-import-modal";
import { BulkImportSummary } from "./bulk-import-summary";
import { FilterChips } from "./filter-chips";
import {
  PHASE_LABELS,
  VOTER_CLASS_LABEL,
  WHITELIST_BOTTOM_GUTTER,
  WHITELIST_FALLBACK_PAGE_SIZE,
  WHITELIST_MIN_PAGE_SIZE,
  WHITELIST_ROW_HEIGHT,
  type BulkRow,
  type BulkSummary,
  type VoterClass,
} from "./whitelist-model";
import { WhitelistPageSkeleton } from "./whitelist-skeleton";
import { WhitelistRow } from "./whitelist-row";

export function WhitelistBody({ election }: { election: Doc<"elections"> }) {
  const list = useQuery(api.whitelist.list, { electionId: election._id });
  const bulkAdd = useMutation(api.whitelist.bulkAdd);
  const rosterMediaRef = useRef<HTMLUListElement | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkDefaultClass, setBulkDefaultClass] =
    useState<VoterClass>("year2Committee");
  const [filterClass, setFilterClass] = useState<VoterClass | "all">("all");
  const [whitelistPage, setWhitelistPage] = useState(0);
  const [whitelistMediaHeight, setWhitelistMediaHeight] = useState<
    number | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<
    | (BulkSummary & {
        attempted: number;
        sourceLabel: string;
      })
    | null
  >(null);

  const editable =
    election.phase === "setup" || election.phase === "internalOpen";

  const filteredList = useMemo(() => {
    if (!list) return [];
    if (filterClass === "all") return list;
    return list.filter((row) => row.voterClass === filterClass);
  }, [list, filterClass]);

  const countByClass = useMemo(() => {
    const counts: Record<VoterClass, number> = {
      topCommittee: 0,
      headExecutive: 0,
      year2Committee: 0,
    };
    if (!list) return counts;
    for (const row of list) counts[row.voterClass] += 1;
    return counts;
  }, [list]);

  useEffect(() => {
    const measureRosterMediaHeight = () => {
      const media = rosterMediaRef.current;
      if (!media) return;

      const { top } = media.getBoundingClientRect();
      setWhitelistMediaHeight(
        Math.max(0, window.innerHeight - top - WHITELIST_BOTTOM_GUTTER),
      );
    };

    measureRosterMediaHeight();
    window.addEventListener("resize", measureRosterMediaHeight);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureRosterMediaHeight);
    if (observer) observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", measureRosterMediaHeight);
      observer?.disconnect();
    };
  }, [list?.length, lastImport, filterClass]);

  const whitelistPageSize = getPageSizeForMediaHeight({
    mediaHeight: whitelistMediaHeight,
    rowHeight: WHITELIST_ROW_HEIGHT,
    minRows: WHITELIST_MIN_PAGE_SIZE,
    fallbackRows: WHITELIST_FALLBACK_PAGE_SIZE,
  });

  const whitelistPageCount = Math.max(
    1,
    Math.ceil(filteredList.length / whitelistPageSize),
  );
  const safeWhitelistPage = Math.min(
    whitelistPage,
    whitelistPageCount - 1,
  );
  const whitelistStart = safeWhitelistPage * whitelistPageSize;
  const whitelistEnd = Math.min(
    whitelistStart + whitelistPageSize,
    filteredList.length,
  );
  const visibleList = filteredList.slice(whitelistStart, whitelistEnd);

  useEffect(() => {
    setWhitelistPage(0);
  }, [filterClass]);

  useEffect(() => {
    if (whitelistPage > whitelistPageCount - 1) {
      setWhitelistPage(Math.max(0, whitelistPageCount - 1));
    }
  }, [whitelistPage, whitelistPageCount]);

  const sendBulk = async (rows: BulkRow[], sourceLabel: string) => {
    setImporting(true);
    try {
      const summary = await bulkAdd({
        electionId: election._id,
        rows,
        defaultClass: bulkDefaultClass,
      });
      setLastImport({ ...summary, attempted: rows.length, sourceLabel });
      const issues = summary.errors.length + summary.warnings.length;
      if (issues === 0) {
        toast.success("Bulk import complete", {
          description: `${summary.inserted} added, ${summary.skipped} skipped, ${summary.reclassified} reclassified.`,
        });
      } else {
        toast.warning("Bulk import finished with issues", {
          description: `${summary.inserted} added, ${summary.errors.length} ${
            summary.errors.length === 1 ? "error" : "errors"
          }, ${summary.warnings.length} ${
            summary.warnings.length === 1 ? "warning" : "warnings"
          }. See details below.`,
        });
      }
      setShowBulk(false);
    } catch (err) {
      toast.error("Import failed", {
        description: getConvexErrorMessage(err, "Import failed."),
      });
    } finally {
      setImporting(false);
    }
  };

  if (list === undefined) {
    return <WhitelistPageSkeleton />;
  }

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Internal whitelist" }]} />

      <header className="space-y-3">
        <SectionMarker
          primary="Internal whitelist"
          secondary={election.name}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
            Evaluator allowlist and class assignment
          </h1>
          {editable ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add evaluator
              </Button>
              <Button variant="outline" onClick={() => setShowBulk(true)}>
                <Upload className="h-4 w-4" aria-hidden /> Bulk import
              </Button>
            </div>
          ) : null}
        </div>
        <MetaGroup className="grid-cols-2 gap-4 pt-3 sm:grid-cols-4">
          <Meta
            label="Cycle phase"
            value={PHASE_LABELS[election.phase]}
          />
          <Meta label="Top committee" value={countByClass.topCommittee} />
          <Meta label="Head executive" value={countByClass.headExecutive} />
          <Meta
            label="Year 2 committee"
            value={countByClass.year2Committee}
          />
        </MetaGroup>
      </header>

      {!editable ? (
        <NoticeStrip
          markerPrimary="Phase lock"
          markerSecondary={PHASE_LABELS[election.phase]}
          markerIcon={
            <Lock className="h-4 w-4 text-[var(--copper)]" aria-hidden />
          }
          headline="Whitelist is frozen for the rest of the cycle"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Adds, edits, and deletes are only allowed during{" "}
            <strong className="font-semibold">Setup</strong> or{" "}
            <strong className="font-semibold">Internal evaluation open</strong>
            . Changing the allowlist after the rubric window has closed
            would alter who is counted in the weighted breakdown. Move the
            cycle back to one of those phases from the{" "}
            <LinkButton
              href="/admin/election"
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
            >
              Election cycle page
            </LinkButton>{" "}
            if a structural change is genuinely necessary.
          </p>
        </NoticeStrip>
      ) : null}

      {lastImport ? (
        <BulkImportSummary
          summary={lastImport}
          onDismiss={() => setLastImport(null)}
        />
      ) : null}

      <AddSingleModal
        open={editable && showAdd}
        electionId={election._id}
        onClose={() => setShowAdd(false)}
      />

      <BulkImportModal
        open={editable && showBulk}
        defaultClass={bulkDefaultClass}
        importing={importing}
        onChangeDefaultClass={setBulkDefaultClass}
        onClose={() => setShowBulk(false)}
        onSubmitPaste={(rows) => sendBulk(rows, "Pasted emails")}
        onSubmitCsv={(rows, fileName) => sendBulk(rows, fileName)}
      />

      <section aria-label="Whitelist roster">
        <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionMarker
              primary="Roster"
              secondary={`${list.length} ${
                list.length === 1 ? "evaluator" : "evaluators"
              }`}
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {filterClass === "all"
                ? "All evaluator classes"
                : VOTER_CLASS_LABEL[filterClass]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <FilterChips
              current={filterClass}
              counts={countByClass}
              total={list.length}
              onChange={setFilterClass}
            />
            {whitelistPageCount > 1 ? (
              <div className="flex items-center gap-2">
                <p className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
                  {String(whitelistStart + 1).padStart(2, "0")}-
                  {String(whitelistEnd).padStart(2, "0")} of{" "}
                  {String(filteredList.length).padStart(2, "0")}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setWhitelistPage((page) => Math.max(0, page - 1))
                  }
                  disabled={safeWhitelistPage === 0}
                  aria-label="Previous whitelist page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setWhitelistPage((page) =>
                      Math.min(whitelistPageCount - 1, page + 1),
                    )
                  }
                  disabled={safeWhitelistPage >= whitelistPageCount - 1}
                  aria-label="Next whitelist page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        </header>
        {filteredList.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-5 w-5" aria-hidden />}
            title={
              filterClass === "all"
                ? "No evaluators on the whitelist yet"
                : `No evaluators in ${VOTER_CLASS_LABEL[filterClass]}`
            }
            description={
              filterClass === "all"
                ? "Internal evaluation cannot start until the whitelist has at least one evaluator. Use Add evaluator or Bulk import to populate it."
                : "Add evaluators with this class, or change the filter above to All classes."
            }
          />
        ) : (
          <ul
            ref={rosterMediaRef}
            key={`${filterClass}-${safeWhitelistPage}`}
            className="divide-y divide-[var(--ink-line)] rounded-md border border-[var(--ink-line)] bg-[var(--paper)]"
            aria-busy={importing ? "true" : undefined}
          >
            {visibleList.map((row) => (
              <WhitelistRow
                key={row._id}
                row={row}
                editable={editable}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

