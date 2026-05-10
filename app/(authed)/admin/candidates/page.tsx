"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertTriangle,
  Lock,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  UserCircle2,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ImportSummaryStrip } from "@/components/admin/import-summary-strip";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";
import {
  CandidateForm,
  type PositionAssignment,
} from "@/components/admin/candidate-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";

import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

interface CandidateRow {
  _id: Id<"candidates">;
  fullName: string;
  matric: string | null;
  bio: string | null;
  photoStorageId: Id<"_storage"> | null;
  photoLinkUrl: string | null;
  photoUrl: string | null;
  positions: {
    positionId: Id<"positions">;
    name: string;
    tier: number;
    fallbackOrder: number;
  }[];
}

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export default function CandidatesPage() {
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

function Body({ election }: { election: Doc<"elections"> }) {
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
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<
    | (ImportSummary & {
        attempted: number;
        fileName: string;
      })
    | null
  >(null);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const editable = election.phase === "setup";

  const editingCandidate = useMemo(() => {
    if (!editingId || !candidates) return null;
    const c = candidates.find((x) => x._id === editingId);
    if (!c) return null;
    const initialAssignments: PositionAssignment[] = c.positions.map((p) => ({
      positionId: p.positionId,
      fallbackOrder: p.fallbackOrder,
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

  if (candidates === undefined || positions === undefined) {
    return <PageSkeleton />;
  }

  const onCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    let description: React.ReactNode;
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
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Candidates" }]} />

      <header className="space-y-5">
        <SectionMarker primary="Candidates" secondary={election.name} />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Roster and contending positions
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Add every candidate running this cycle and pick the positions they
          are contending, in their order of preference. The first position
          on a candidate&apos;s list is their first choice; lower entries
          are the cascade fallback if a higher-tier position fills first.
        </p>
        <MetaGroup className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <Meta label="Cycle phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="Positions defined" value={positions.length} />
          <Meta label="Candidates" value={candidates.length} />
          <Meta
            label="Position slots filled"
            value={totalPositionsCovered}
          />
        </MetaGroup>
        {editable && !noPositions ? (
          <div className="flex flex-wrap items-center gap-2">
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
        description="Enter the candidate's name, pick the positions they are contending in order of preference, and attach a photo (upload or paste a Drive/image link)."
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
          <header className="mb-3 flex items-baseline gap-3">
            <SectionMarker
              primary="Roster"
              secondary={`${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}`}
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              Sorted by name
            </p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            {candidates.map((c) => (
              <CandidateCard
                key={c._id}
                c={c}
                editable={editable}
                onEdit={() => setEditingId(c._id)}
                onRemove={() => onRemove(c)}
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

function CandidateCard({
  c,
  editable,
  onEdit,
  onRemove,
}: {
  c: CandidateRow;
  editable: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const sortedPositions = useMemo(
    () =>
      c.positions.slice().sort((a, b) => a.fallbackOrder - b.fallbackOrder),
    [c.positions],
  );

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--color-muted)]">
          {c.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <UserCircle2
              className="h-8 w-8 text-[var(--color-muted-foreground)]"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--ink)]">
                {c.fullName}
              </h3>
              {c.matric && !c.matric.startsWith("auto-") ? (
                <p className="font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {c.matric}
                </p>
              ) : null}
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
              className="mt-2 flex flex-wrap items-center gap-1"
              aria-label="Contending positions in order of preference"
            >
              {sortedPositions.map((p, i) => (
                <li key={p.positionId}>
                  <Badge
                    tone={i === 0 ? "brand" : "muted"}
                    className="text-[10px]"
                  >
                    <span className="font-mono tabular-nums">{i + 1}</span>{" "}
                    {p.name}
                  </Badge>
                </li>
              ))}
            </ol>
          ) : (
            <p
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--copper)]"
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
