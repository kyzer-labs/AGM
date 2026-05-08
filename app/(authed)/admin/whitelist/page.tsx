"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { Doc } from "@/convex/_generated/dataModel";

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
  const list = useQuery(api.whitelist.list, { electionId: election._id });
  const add = useMutation(api.whitelist.add);
  const bulkAdd = useMutation(api.whitelist.bulkAdd);
  const remove = useMutation(api.whitelist.remove);

  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const editable =
    election.phase === "setup" || election.phase === "internalOpen";

  const onAddSingle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!single.trim()) return;
    setBusy(true);
    try {
      await add({ electionId: election._id, email: single });
      toast.success("Email added");
      setSingle("");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Add failed.";
      toast.error("Add failed", { description: m });
    } finally {
      setBusy(false);
    }
  };

  const importBulk = async (emails: string[]) => {
    setBusy(true);
    try {
      const summary = await bulkAdd({ electionId: election._id, emails });
      const parts = [
        `${summary.inserted} added`,
        `${summary.skipped} skipped`,
      ];
      if (summary.invalid.length > 0) {
        parts.push(`${summary.invalid.length} invalid`);
      }
      toast.success("Bulk import complete", { description: parts.join(" · ") });
      setBulk("");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Import failed.";
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
    await importBulk(emails);
  };

  const onCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse<string[]>(file, {
      complete: (result) => {
        const flat: string[] = [];
        for (const row of result.data) {
          for (const cell of row) {
            if (typeof cell === "string" && cell.trim().length > 0) {
              flat.push(cell.trim());
            }
          }
        }
        void importBulk(flat);
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
            Year 2 committee members who can submit internal evaluations for
            <strong> {election.name}</strong>. Year 1 members and other
            students are NOT added here — they vote externally on AGM day.
          </p>
        </div>
        <Badge tone={editable ? "muted" : "warning"}>
          {editable ? "Editable" : "Locked"}
        </Badge>
      </header>

      {editable ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add one</CardTitle>
              <CardDescription>
                Email must end in <code>@student.usm.my</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAddSingle} className="flex items-end gap-2">
                <div className="grid flex-1 gap-1.5">
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
                <Button type="submit" loading={busy}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bulk import</CardTitle>
              <CardDescription>
                Paste comma/space/newline-separated emails, or upload a CSV.
                Duplicates and non-USM addresses are skipped automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPasteSubmit} className="grid gap-3">
                <Textarea
                  rows={5}
                  placeholder={"alice@student.usm.my\nbob@student.usm.my"}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" loading={busy}>
                    Import pasted emails
                  </Button>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={onCsvUpload}
                    />
                    <span
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-transparent px-4 text-sm font-medium hover:bg-[var(--color-muted)]"
                    >
                      <Upload className="h-4 w-4" /> Upload CSV
                    </span>
                  </label>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Whitelist <span className="text-[var(--color-muted-foreground)]">({list.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-5 w-5" aria-hidden />}
              title="No emails added yet"
              description="Internal evaluation cannot start until the whitelist has at least one Year 2 evaluator."
            />
          ) : (
            <ul className="divide-y">
              {list.map((row) => (
                <li
                  key={row._id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm">{row.email}</span>
                  {editable ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm(`Remove ${row.email}?`)) return;
                        void remove({ entryId: row._id }).then(
                          () => toast.success("Removed"),
                          (err: unknown) => {
                            const m =
                              err instanceof Error
                                ? err.message
                                : "Remove failed.";
                            toast.error("Remove failed", {
                              description: m,
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
