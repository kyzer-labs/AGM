"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  SlidersHorizontal,
  UploadCloud,
  UserCircle2,
} from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ImportSummaryStrip } from "@/components/admin/import-summary-strip";
import { useDialog } from "@/components/dialog/dialog-provider";
import {
  CandidateForm,
  type PositionAssignment,
} from "@/components/admin/candidate-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { cn } from "@/lib/utils";
import { getGridPageSizeForMediaHeight } from "@/lib/viewport-pagination";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CandidateCard } from "./candidate-card";
import {
  DEFAULT_ROSTER_SORT,
  PHASE_LABELS,
  ROSTER_BOTTOM_GUTTER,
  ROSTER_CARD_ROW_HEIGHT,
  ROSTER_DESKTOP_COLUMNS,
  ROSTER_FALLBACK_PAGE_SIZE,
  ROSTER_MIN_ROWS,
  ROSTER_MOBILE_COLUMNS,
  ROSTER_SORTS,
  type CandidateRow,
  type ImportSummary,
  type RosterSort,
} from "./candidates-model";
import { CandidatesPageSkeleton } from "./candidates-skeleton";

export function CandidatesBody({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const candidates = useQuery(api.candidates.list, {
    electionId: election._id,
  });
  const positions = useQuery(api.positions.list, {
    electionId: election._id,
  });
  const removeCandidate = useMutation(api.candidates.remove);
  const csvImport = useMutation(api.candidates.csvImport);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"candidates"> | null>(null);
  const [rosterPage, setRosterPage] = useState(0);
  const [rosterSort, setRosterSort] = useState<RosterSort>("name");
  const [rosterMediaHeight, setRosterMediaHeight] = useState<number | null>(
    null,
  );
  const [rosterColumns, setRosterColumns] = useState(ROSTER_DESKTOP_COLUMNS);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<
    | (ImportSummary & {
        attempted: number;
        fileName: string;
      })
    | null
  >(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const rosterMediaRef = useRef<HTMLDivElement | null>(null);

  const editable = election.phase === "setup";

  const editingCandidate = useMemo(() => {
    if (!editingId || !candidates) return null;
    const c = candidates.find((x) => x._id === editingId);
    if (!c) return null;
    const initialAssignments: PositionAssignment[] = c.positions.map((p) => ({
      positionId: p.positionId,
    }));
    return {
      candidateId: c._id,
      fullName: c.fullName,
      photoStorageId: c.photoStorageId,
      photoLinkUrl: c.photoLinkUrl,
      photoUrl: c.photoUrl,
      assignments: initialAssignments,
    };
  }, [candidates, editingId]);

  const sortedCandidates = useMemo(() => {
    const rows = candidates?.slice() ?? [];
    const byName = (a: CandidateRow, b: CandidateRow) =>
      a.fullName.localeCompare(b.fullName, "en");
    const precedence = (c: CandidateRow) => {
      const primary = c.positions
        .slice()
        .sort(
          (a, b) =>
            a.tier - b.tier ||
            a.order - b.order ||
            a.name.localeCompare(b.name),
        )[0];
      return primary
        ? { tier: primary.tier, order: primary.order, name: primary.name }
        : {
            tier: Number.POSITIVE_INFINITY,
            order: Number.POSITIVE_INFINITY,
            name: "",
          };
    };

    return rows.sort((a, b) => {
      if (rosterSort === "position") {
        const aPrecedence = precedence(a);
        const bPrecedence = precedence(b);
        return (
          aPrecedence.tier - bPrecedence.tier ||
          aPrecedence.order - bPrecedence.order ||
          aPrecedence.name.localeCompare(bPrecedence.name, "en") ||
          byName(a, b)
        );
      }
      return byName(a, b);
    });
  }, [candidates, rosterSort]);

  const rosterCandidateCount = sortedCandidates.length;
  useEffect(() => {
    const measureRosterMedia = () => {
      const media = rosterMediaRef.current;
      if (!media) return;

      const { top } = media.getBoundingClientRect();
      setRosterMediaHeight(
        Math.max(0, window.innerHeight - top - ROSTER_BOTTOM_GUTTER),
      );
      setRosterColumns(
        window.innerWidth >= 768
          ? ROSTER_DESKTOP_COLUMNS
          : ROSTER_MOBILE_COLUMNS,
      );
    };

    measureRosterMedia();
    window.addEventListener("resize", measureRosterMedia);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureRosterMedia);
    if (observer) observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", measureRosterMedia);
      observer?.disconnect();
    };
  }, [rosterCandidateCount, lastImport, rosterSort]);

  const rosterPageSize = getGridPageSizeForMediaHeight({
    mediaHeight: rosterMediaHeight,
    rowHeight: ROSTER_CARD_ROW_HEIGHT,
    columns: rosterColumns,
    minRows: ROSTER_MIN_ROWS,
    fallbackRows: ROSTER_FALLBACK_PAGE_SIZE,
  });
  const rosterPageCount = Math.max(
    1,
    Math.ceil(rosterCandidateCount / rosterPageSize),
  );

  useEffect(() => {
    if (rosterPage > rosterPageCount - 1) {
      setRosterPage(Math.max(0, rosterPageCount - 1));
    }
  }, [rosterPage, rosterPageCount]);

  useEffect(() => {
    setRosterPage(0);
  }, [rosterSort]);

  if (candidates === undefined || positions === undefined) {
    return <CandidatesPageSkeleton />;
  }

  const safeRosterPage = Math.min(rosterPage, rosterPageCount - 1);
  const rosterStart = safeRosterPage * rosterPageSize;
  const rosterEnd = Math.min(
    rosterStart + rosterPageSize,
    sortedCandidates.length,
  );
  const visibleCandidates = sortedCandidates.slice(rosterStart, rosterEnd);
  const activeSort =
    ROSTER_SORTS.find((option) => option.value === rosterSort) ??
    DEFAULT_ROSTER_SORT;

  const onCsvUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setLastImport(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (result) => {
        try {
          const fatalParseErrors = result.errors.filter(
            (err) => err.code !== "TooFewFields",
          );
          if (fatalParseErrors.length > 0) {
            const first = fatalParseErrors[0];
            const rowLabel =
              typeof first?.row === "number"
                ? `Row ${first.row + 2}`
                : "CSV";
            toast.error("Could not parse CSV", {
              description: `${rowLabel}: ${first?.message ?? "Unknown parse error"}`,
            });
            return;
          }

          const detected = (result.meta.fields ?? []).map((c) => c.trim());
          const detectedLc = new Set(
            detected.map((c) => c.toLowerCase()),
          );
          const hasFullName =
            detectedLc.has("fullname") ||
            detectedLc.has("full name") ||
            detectedLc.has("name");
          if (!hasFullName) {
            toast.error("CSV missing required column", {
              description: `Add a "fullName" column. Detected columns: ${
                detected.length > 0 ? detected.join(", ") : "(none)"
              }.`,
            });
            return;
          }

          const rows = result.data.flatMap((row) => {
            const fullName = (
              row.fullName ??
              row["Full Name"] ??
              row.name ??
              row.Name ??
              ""
            ).trim();
            if (!fullName) return [];
            const matric = (
              row.matric ??
              row.matricNumber ??
              row.Matric ??
              ""
            ).trim();
            const photoUrl = (
              row.photoUrl ??
              row.PhotoUrl ??
              row["Photo URL"] ??
              row.photo ??
              row.Photo ??
              ""
            ).trim();
            const bio = (row.bio ?? row.Bio ?? "").trim();
            const positionsCol = (
              row.positions ??
              row.Positions ??
              row.eligiblePositions ??
              ""
            ).trim();
            return [
              {
                fullName,
                matric: matric.length > 0 ? matric : undefined,
                bio: bio.length > 0 ? bio : undefined,
                positions:
                  positionsCol.length > 0 ? positionsCol : undefined,
                photoUrl: photoUrl.length > 0 ? photoUrl : undefined,
              },
            ];
          });

          if (rows.length === 0) {
            toast.error("No usable rows", {
              description:
                "Every row was missing a fullName value. Add the candidate name to each row and re-import.",
            });
            return;
          }

          const summary = await csvImport({
            electionId: election._id,
            rows,
          });
          const attempted = rows.length;
          setLastImport({ ...summary, attempted, fileName: file.name });

          if (summary.errors.length === 0) {
            toast.success("Import complete", {
              description: `${summary.inserted} added, ${summary.skipped} skipped (duplicate matric or name).`,
            });
          } else {
            toast.warning("Import finished with errors", {
              description: `${summary.inserted} added, ${summary.skipped} skipped, ${summary.errors.length} ${
                summary.errors.length === 1 ? "row needs" : "rows need"
              } review.`,
            });
          }
        } catch (err) {
          toast.error("Import failed", {
            description: getConvexErrorMessage(err, "Import failed."),
          });
        } finally {
          setImporting(false);
        }
      },
      error: (err) => {
        setImporting(false);
        toast.error("CSV parse failed", { description: err.message });
      },
    });
  };

  const onRemove = async (c: CandidateRow) => {
    const positionCount = c.positions.length;
    let description: ReactNode;
    if (positionCount === 0) {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{c.fullName}</strong>. They are
          not currently listed for any position, so nothing else changes.
          The action cannot be undone.
        </>
      );
    } else {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{c.fullName}</strong>. This also
          unassigns them from{" "}
          <strong className="font-semibold tabular-nums">
            {positionCount}
          </strong>{" "}
          {positionCount === 1 ? "position" : "positions"} (
          {c.positions.map((p) => p.name).join(", ")}). The action cannot be
          undone.
        </>
      );
    }

    const ok = await dialog.confirm({
      title: "Delete this candidate?",
      description,
      confirmText: "Delete candidate",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await removeCandidate({ candidateId: c._id });
      toast.success("Candidate deleted");
    } catch (err) {
      toast.error("Delete failed", {
        description: getConvexErrorMessage(err, "Delete failed."),
      });
    }
  };

  const noPositions = positions.length === 0;
  const totalPositionsCovered = candidates.reduce(
    (sum, c) => sum + c.positions.length,
    0,
  );

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Candidates" }]} />

      <header className="space-y-3">
        <SectionMarker primary="Candidates" secondary={election.name} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
            Roster and contending positions
          </h1>
          {editable && !noPositions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add candidate
              </Button>
              <Button
                variant="outline"
                loading={importing}
                onClick={() => csvInputRef.current?.click()}
              >
                <UploadCloud className="h-4 w-4" aria-hidden /> Import CSV
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={onCsvUpload}
                disabled={importing}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          ) : null}
        </div>
        <MetaGroup className="grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          <Meta label="Cycle phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="Positions defined" value={positions.length} />
          <Meta label="Candidates" value={candidates.length} />
          <Meta
            label="Position slots filled"
            value={totalPositionsCovered}
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
          headline="Candidates are frozen for the rest of the cycle"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Adds, edits, and deletes are only allowed while the cycle is in{" "}
            <strong className="font-semibold">Setup</strong>. Changing the
            roster after evaluations or votes have started would invalidate
            data already collected. Move the cycle back to Setup from the{" "}
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

      {editable && noPositions ? (
        <NoticeStrip
          markerPrimary="Setup pending"
          markerSecondary="Positions"
          markerIcon={
            <AlertTriangle
              className="h-4 w-4 text-[var(--copper)]"
              aria-hidden
            />
          }
          headline="Add positions before adding candidates"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Each candidate must list at least one contending position.
            Configure the ballot order on the{" "}
            <LinkButton
              href="/admin/positions"
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
            >
              Positions page
            </LinkButton>{" "}
            first, then return here to add candidates.
          </p>
        </NoticeStrip>
      ) : null}

      {lastImport ? (
        <ImportSummaryStrip
          markerPrimary="Last CSV import"
          markerSecondary={lastImport.fileName}
          headline={`${lastImport.inserted} of ${lastImport.attempted} ${
            lastImport.attempted === 1 ? "row" : "rows"
          } imported`}
          stats={{
            added: lastImport.inserted,
            skipped: lastImport.skipped,
            errors: lastImport.errors.length,
          }}
          errors={lastImport.errors.map((err) => ({
            displayRow: `Row ${err.row}`,
            reason: err.message,
          }))}
          tone={lastImport.errors.length > 0 ? "copper" : "neutral"}
          onDismiss={() => setLastImport(null)}
        />
      ) : null}

      <Modal
        open={adding && !noPositions}
        onClose={() => setAdding(false)}
        title="Add candidate"
        description="Enter the candidate's name, pick the positions they are contending for, and attach a photo (upload or paste a Drive/image link)."
      >
        <CandidateForm
          electionId={election._id}
          positions={positions}
          onSaved={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal
        open={editingCandidate !== null && !noPositions}
        onClose={() => setEditingId(null)}
        title={
          editingCandidate ? `Edit ${editingCandidate.fullName}` : "Edit"
        }
      >
        {editingCandidate ? (
          <CandidateForm
            electionId={election._id}
            positions={positions}
            initial={editingCandidate}
            onSaved={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
          />
        ) : null}
      </Modal>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<UserCircle2 className="h-5 w-5" aria-hidden />}
          title="No candidates yet"
          description={
            !editable
              ? "Candidates can only be added during the Setup phase."
              : noPositions
                ? "Add positions first, then return here to add candidates."
                : "Use Add candidate for one-at-a-time entry, or Import CSV for bulk loads."
          }
        />
      ) : (
        <section aria-label="Candidate roster">
          <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <SectionMarker
                primary="Roster"
                secondary={`${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}`}
              />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                {activeSort.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="flex items-center gap-1.5">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-[var(--ink-line)] bg-[var(--paper)] text-[var(--ink-muted)]">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div
                  className="flex items-center rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-0.5"
                  aria-label="Sort candidate roster"
                >
                  {ROSTER_SORTS.map((option) => {
                    const selected = option.value === rosterSort;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRosterSort(option.value)}
                        className={cn(
                          "h-7 rounded px-3 font-mono text-[10.5px] uppercase tracking-[0.12em]",
                          "transition-[background-color,color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                          selected
                            ? "bg-[var(--ink)] text-[var(--paper)] shadow-sm"
                            : "text-[var(--ink-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--ink)]",
                        )}
                        aria-pressed={selected}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {rosterPageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <p className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
                    {String(rosterStart + 1).padStart(2, "0")}-
                    {String(rosterEnd).padStart(2, "0")} of{" "}
                    {String(candidates.length).padStart(2, "0")}
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setRosterPage((page) => Math.max(0, page - 1))
                    }
                    disabled={safeRosterPage === 0}
                    aria-label="Previous candidate page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setRosterPage((page) =>
                        Math.min(rosterPageCount - 1, page + 1),
                      )
                    }
                    disabled={safeRosterPage >= rosterPageCount - 1}
                    aria-label="Next candidate page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          </header>
          <div
            ref={rosterMediaRef}
            key={`${rosterSort}-${safeRosterPage}`}
            className="grid content-start gap-3 md:grid-cols-2"
          >
            {visibleCandidates.map((c, index) => (
              <CandidateCard
                key={c._id}
                c={c}
                editable={editable}
                onEdit={() => setEditingId(c._id)}
                onRemove={() => onRemove(c)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {!editable ? (
        <p
          className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
          aria-live="polite"
        >
          Edit, delete, and import are disabled outside the Setup phase.
        </p>
      ) : null}
    </main>
  );
}
