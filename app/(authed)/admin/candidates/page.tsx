"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  UserCircle2,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import {
  CandidateForm,
  type PositionAssignment,
} from "@/components/admin/candidate-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export default function CandidatesPage() {
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

interface CandidateRow {
  _id: Id<"candidates">;
  fullName: string;
  matric: string;
  bio: string | null;
  photoStorageId: Id<"_storage"> | null;
  photoUrl: string | null;
  positions: {
    positionId: Id<"positions">;
    name: string;
    tier: number;
    fallbackOrder: number;
  }[];
}

function Body({ election }: { election: Doc<"elections"> }) {
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
      matric: c.matric,
      bio: c.bio,
      photoStorageId: c.photoStorageId,
      photoUrl: c.photoUrl,
      assignments: initialAssignments,
    };
  }, [candidates, editingId]);

  if (candidates === undefined || positions === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const onCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = result.data.flatMap((row) => {
          const fullName =
            row.fullName ?? row["Full Name"] ?? row.name ?? row.Name;
          const matric = row.matric ?? row.matricNumber ?? row.Matric;
          if (!fullName || !matric) return [];
          return [
            {
              fullName,
              matric,
              bio: row.bio ?? row.Bio ?? undefined,
              positions:
                row.positions ??
                row.Positions ??
                row.eligiblePositions ??
                undefined,
            },
          ];
        });
        if (rows.length === 0) {
          setImporting(false);
          toast.error("No usable rows found in CSV.", {
            description:
              "Required columns: fullName, matric. Optional: bio, positions.",
          });
          return;
        }
        try {
          const summary = await csvImport({
            electionId: election._id,
            rows,
          });
          toast.success("Import complete", {
            description: `${summary.inserted} added · ${summary.skipped} skipped · ${summary.errors.length} errors`,
          });
        } catch (err) {
          const m = getConvexErrorMessage(err, "Import failed.");
          toast.error("Import failed", { description: m });
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

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Candidates" }]} />
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Add candidates running for{" "}
            <strong>{election.name}</strong> and pick the positions they are
            eligible for, in their order of preference.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <Button onClick={() => setAdding((v) => !v)}>
                <Plus className="h-4 w-4" /> {adding ? "Close" : "Add candidate"}
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={onCsvUpload}
                  disabled={importing}
                />
                <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-transparent px-4 text-sm font-medium hover:bg-[var(--color-muted)]">
                  <UploadCloud className="h-4 w-4" /> Import CSV
                </span>
              </label>
            </>
          ) : (
            <Badge tone="warning">Locked — election not in Setup</Badge>
          )}
        </div>
      </header>

      {positions.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="Add positions first"
          description="A candidate has to be eligible for at least one position. Configure positions before adding candidates."
        />
      ) : null}

      {adding && positions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add candidate</CardTitle>
            <CardDescription>
              You can add a photo, a short bio, and one or more eligible
              positions in preference order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CandidateForm
              electionId={election._id}
              positions={positions}
              onSaved={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </CardContent>
        </Card>
      ) : null}

      {editingCandidate && positions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Editing {editingCandidate.fullName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CandidateForm
              electionId={election._id}
              positions={positions}
              initial={editingCandidate}
              onSaved={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          </CardContent>
        </Card>
      ) : null}

      {candidates.length === 0 ? (
        <EmptyState
          icon={<UserCircle2 className="h-5 w-5" aria-hidden />}
          title="No candidates yet"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((c) => (
            <CandidateCard
              key={c._id}
              c={c}
              editable={editable}
              onEdit={() => setEditingId(c._id)}
              onRemove={() => {
                if (
                  !window.confirm(
                    `Remove candidate "${c.fullName}"? This also unassigns them from all positions.`,
                  )
                )
                  return;
                void removeCandidate({ candidateId: c._id }).then(
                  () => toast.success("Candidate removed"),
                  (err: unknown) => {
                    const m =
                      getConvexErrorMessage(err, "Remove failed.");
                    toast.error("Remove failed", { description: m });
                  },
                );
              }}
            />
          ))}
        </div>
      )}
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
              <h3 className="truncate text-sm font-semibold">{c.fullName}</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {c.matric}
              </p>
            </div>
            {editable ? (
              <div className="flex items-center">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRemove}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                </Button>
              </div>
            ) : null}
          </div>
          {c.bio ? (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
              {c.bio}
            </p>
          ) : null}
          {c.positions.length > 0 ? (
            <ol className="mt-2 flex flex-wrap items-center gap-1">
              {c.positions
                .slice()
                .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
                .map((p, i) => (
                  <li key={p.positionId}>
                    <Badge tone={i === 0 ? "brand" : "muted"} className="text-[10px]">
                      {i + 1}. {p.name}
                    </Badge>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              Not assigned to any position yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
