"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

const VOTER_CLASS_OPTIONS: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

const VOTER_CLASS_TONE: Record<VoterClass, "brand" | "warning" | "muted"> = {
  topCommittee: "brand",
  headExecutive: "warning",
  year2Committee: "muted",
};

export default function WhitelistPage() {
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
  const list = useQuery(api.whitelist.list, { electionId: election._id });
  const add = useMutation(api.whitelist.add);
  const bulkAdd = useMutation(api.whitelist.bulkAdd);
  const remove = useMutation(api.whitelist.remove);
  const setClass = useMutation(api.whitelist.setClass);

  const [single, setSingle] = useState("");
  const [singleClass, setSingleClass] = useState<VoterClass>("year2Committee");
  const [bulk, setBulk] = useState("");
  const [bulkDefaultClass, setBulkDefaultClass] = useState<VoterClass>("year2Committee");
  const [filterClass, setFilterClass] = useState<VoterClass | "all">("all");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

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

  const onAddSingle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!single.trim()) return;
    setBusy(true);
    try {
      await add({
        electionId: election._id,
        email: single,
        voterClass: singleClass,
      });
      toast.success("Email added");
      setSingle("");
      setShowAdd(false);
    } catch (err) {
      const m = getConvexErrorMessage(err, "Add failed.");
      toast.error("Add failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const importBulk = async (
    rows: { email: string; voterClass?: string }[],
    defaultClass: VoterClass,
  ) => {
    setBusy(true);
    try {
      const summary = await bulkAdd({
        electionId: election._id,
        rows,
        defaultClass,
      });
      const parts = [`${summary.inserted} added`, `${summary.skipped} skipped`];
      if (summary.reclassified > 0)
        parts.push(`${summary.reclassified} reclassified`);
      if (summary.invalid.length > 0)
        parts.push(`${summary.invalid.length} invalid`);
      toast.success("Bulk import complete", { description: parts.join(" · ") });
      setBulk("");
      setShowBulk(false);
    } catch (err) {
      const m = getConvexErrorMessage(err, "Import failed.");
      toast.error("Import failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const onPasteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emails = bulk
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (emails.length === 0) return;
    await importBulk(
      emails.map((email) => ({ email })),
      bulkDefaultClass,
    );
  };

  const onCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows: { email: string; voterClass?: string }[] = [];
        for (const row of result.data) {
          const email =
            row.email ??
            row.Email ??
            row["E-mail"] ??
            row["e-mail"] ??
            Object.values(row)[0];
          if (typeof email !== "string" || email.trim().length === 0) continue;
          const cls =
            row.voterClass ??
            row.VoterClass ??
            row.class ??
            row.Class ??
            row.role ??
            row.Role;
          rows.push(
            cls && cls.trim().length > 0
              ? { email: email.trim(), voterClass: cls.trim() }
              : { email: email.trim() },
          );
        }
        if (rows.length === 0) {
          // Try header-less parsing as a fallback
          Papa.parse<string[]>(file, {
            complete: (r2) => {
              const flat: { email: string }[] = [];
              for (const row of r2.data) {
                for (const cell of row) {
                  if (typeof cell === "string" && cell.trim().length > 0) {
                    flat.push({ email: cell.trim() });
                  }
                }
              }
              if (flat.length > 0) void importBulk(flat, bulkDefaultClass);
              else
                toast.error("No usable rows found in CSV.", {
                  description:
                    "Required column: email. Optional: voterClass.",
                });
            },
          });
          return;
        }
        void importBulk(rows, bulkDefaultClass);
      },
      error: (err) => {
        toast.error("CSV parse failed", { description: err.message });
      },
    });
  };

  if (list === undefined)
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Internal whitelist" }]} />
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Internal whitelist
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Committee members who can submit internal evaluations for{" "}
            <strong>{election.name}</strong>. Each evaluator is assigned to a
            class — Top Committee, Head Executive, or Year 2 Committee — and
            their class&apos;s configured weight applies to their submitted
            scores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add evaluator
              </Button>
              <Button variant="outline" onClick={() => setShowBulk(true)}>
                <Upload className="h-4 w-4" /> Bulk import
              </Button>
            </>
          ) : (
            <Badge tone="warning">Locked</Badge>
          )}
        </div>
      </header>

      <Modal
        open={editable && showAdd}
        onClose={() => setShowAdd(false)}
        title="Add evaluator"
        description={
          <>
            Email must end in <code>@student.usm.my</code>.
          </>
        }
        size="md"
      >
        <form onSubmit={onAddSingle} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-email">Student email</Label>
            <Input
              id="wl-email"
              type="email"
              autoComplete="off"
              placeholder="someone@student.usm.my"
              value={single}
              onChange={(e) => setSingle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-class">Class</Label>
            <Select
              id="wl-class"
              value={singleClass}
              onChange={(e) => setSingleClass(e.target.value as VoterClass)}
            >
              {VOTER_CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {VOTER_CLASS_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editable && showBulk}
        onClose={() => setShowBulk(false)}
        title="Bulk import evaluators"
        description={
          <>
            Paste comma/space/newline-separated emails, or upload a CSV with{" "}
            <code>email</code> and optional <code>voterClass</code> columns.
            Rows without a class fall back to the default below.
          </>
        }
      >
        <form onSubmit={onPasteSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-bulk">Emails</Label>
            <Textarea
              id="wl-bulk"
              rows={6}
              placeholder={"alice@student.usm.my\nbob@student.usm.my"}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-bulk-class">Default class</Label>
            <Select
              id="wl-bulk-class"
              value={bulkDefaultClass}
              onChange={(e) =>
                setBulkDefaultClass(e.target.value as VoterClass)
              }
            >
              {VOTER_CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {VOTER_CLASS_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={onCsvUpload}
              />
              <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-transparent px-4 text-sm font-medium hover:bg-[var(--color-muted)]">
                <Upload className="h-4 w-4" /> Upload CSV
              </span>
            </label>
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowBulk(false)}
            >
              Close
            </Button>
            <Button type="submit" loading={busy} disabled={bulk.trim() === ""}>
              Import pasted emails
            </Button>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base">
              Whitelist{" "}
              <span className="text-[var(--color-muted-foreground)]">
                ({list.length})
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {VOTER_CLASS_OPTIONS.map((c) => (
                <Badge key={c} tone={VOTER_CLASS_TONE[c]}>
                  {VOTER_CLASS_LABEL[c]}: {countByClass[c]}
                </Badge>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Label htmlFor="wl-filter" className="text-xs">
                Filter
              </Label>
              <Select
                id="wl-filter"
                value={filterClass}
                onChange={(e) =>
                  setFilterClass(e.target.value as VoterClass | "all")
                }
                className="h-8 w-44"
              >
                <option value="all">All classes</option>
                {VOTER_CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {VOTER_CLASS_LABEL[c]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredList.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-5 w-5" aria-hidden />}
              title={
                filterClass === "all"
                  ? "No emails added yet"
                  : `No evaluators in ${VOTER_CLASS_LABEL[filterClass]}`
              }
              description={
                filterClass === "all"
                  ? "Internal evaluation cannot start until the whitelist has at least one evaluator with a non-zero weighted class."
                  : "Use the form above to add some, or change the filter."
              }
            />
          ) : (
            <ul className="divide-y">
              {filteredList.map((row) => (
                <li
                  key={row._id}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <span className="flex-1 text-sm">{row.email}</span>
                  {editable ? (
                    <Select
                      value={row.voterClass}
                      onChange={async (e) => {
                        const v = e.target.value as VoterClass;
                        try {
                          await setClass({
                            entryId: row._id,
                            voterClass: v,
                          });
                          toast.success("Class updated");
                        } catch (err) {
                          const m =
                            friendlyError(err, "Update failed.");
                          toast.error("Update failed", { description: m });
                        }
                      }}
                      className="h-8 w-44"
                    >
                      {VOTER_CLASS_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {VOTER_CLASS_LABEL[c]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={VOTER_CLASS_TONE[row.voterClass]}>
                      {VOTER_CLASS_LABEL[row.voterClass]}
                    </Badge>
                  )}
                  {editable ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm(`Remove ${row.email}?`)) return;
                        void remove({ entryId: row._id }).then(
                          () => toast.success("Removed"),
                          (err: unknown) => {
                            toast.error("Remove failed", {
                              description: getConvexErrorMessage(
                                err,
                                "Remove failed.",
                              ),
                            });
                          },
                        );
                      }}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
