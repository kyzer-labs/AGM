"use client";

import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Download,
  FileSearch,
  FileSpreadsheet,
  ShieldAlert,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/csv";
import type { Doc } from "@/convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";

export default function ExportsPage() {
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
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const convex = useConvex();
  const emergencyVoterAudit = useMutation(api.exports.emergencyVoterAudit);

  const [busy, setBusy] = useState<string | null>(null);
  const [emTarget, setEmTarget] = useState("");
  const [emReason, setEmReason] = useState("");
  const [emResult, setEmResult] = useState<{
    target: {
      email: string;
      fullName: string;
      matric: string;
      profileComplete: boolean;
      createdAt: string;
    };
    auditEntries: {
      createdAt: string;
      action: string;
      entityType: string;
      entityId: string;
      reason: string;
      payload: string;
    }[];
    voteCount: number;
    evaluationCount: number;
  } | null>(null);

  const isSuper = adminStatus?.role === "super";

  const safeName = election.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const downloadInternal = async () => {
    setBusy("internal");
    try {
      const rows = await convex.query(api.exports.internalScores, {
        electionId: election._id,
      });
      downloadCsv(rows, `${safeName}-internal-scores.csv`);
      toast.success("Downloaded internal scores");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const downloadInternalByClass = async () => {
    setBusy("internalByClass");
    try {
      const rows = await convex.query(api.exports.internalScoresByClass, {
        electionId: election._id,
      });
      downloadCsv(rows, `${safeName}-internal-scores-by-class.csv`);
      toast.success("Downloaded per-class scores");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const downloadPublicCounts = async () => {
    setBusy("publicCounts");
    try {
      const rows = await convex.query(api.exports.publicCounts, {
        electionId: election._id,
      });
      downloadCsv(rows, `${safeName}-public-counts.csv`);
      toast.success("Downloaded public counts");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const downloadCombined = async () => {
    setBusy("combined");
    try {
      const rows = await convex.query(api.exports.combined, {
        electionId: election._id,
      });
      downloadCsv(rows, `${safeName}-combined-results.csv`);
      toast.success("Downloaded combined results");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const downloadParticipation = async () => {
    setBusy("participation");
    try {
      const rows = await convex.query(api.exports.participation, {
        electionId: election._id,
      });
      downloadCsv(rows, `${safeName}-participation.csv`);
      toast.success("Downloaded participation");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const downloadAudit = async () => {
    setBusy("audit");
    try {
      const rows = await convex.query(api.exports.auditLog, {});
      downloadCsv(rows, `${safeName}-audit-log.csv`);
      toast.success("Downloaded audit log");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Export failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  const onEmergencyLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuper) return;
    setBusy("emergency");
    try {
      const result = await emergencyVoterAudit({
        targetEmail: emTarget,
        reason: emReason,
      });
      setEmResult(result);
      toast.success("Lookup complete (logged)");
    } catch (err) {
      const m = friendlyError(err, "Failed.");
      toast.error("Lookup failed", { description: m });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Exports" }]} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Exports</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          CSV downloads of every artefact for{" "}
          <strong>{election.name}</strong>. Use these for archives, council
          minutes, and post-mortems.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <ExportCard
          title="Internal rubric scores"
          description="Per evaluator × candidate × criterion. Includes draft + submitted, voter class column, and the configured max score for each row."
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
          loading={busy === "internal"}
          onClick={downloadInternal}
        />
        <ExportCard
          title="Internal scores by class"
          description="Aggregated per voter-class × candidate: evaluator count, sum-of-totals, class share, and weighted contribution. Useful for AGM minutes and tie-break review."
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
          loading={busy === "internalByClass"}
          onClick={downloadInternalByClass}
        />
        <ExportCard
          title="Public vote counts"
          description="Per position × candidate vote totals. No per-voter detail (privacy preserved)."
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
          loading={busy === "publicCounts"}
          onClick={downloadPublicCounts}
        />
        <ExportCard
          title="Combined results"
          description="The weighted 60/40 output (per cycle): per-class shares (TC/HE/Y2), public share, internal aggregate, public aggregate, final score, and winner. Includes tie-break-step column."
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
          loading={busy === "combined"}
          onClick={downloadCombined}
        />
        <ExportCard
          title="Participation"
          description="Per voter snapshot: completed profile, internal evaluator status, evaluation status, positions voted on."
          icon={<Users className="h-4 w-4" aria-hidden />}
          loading={busy === "participation"}
          onClick={downloadParticipation}
        />
        <ExportCard
          title="Audit log"
          description="Every privileged action with timestamp, actor email, action, entity, and reason. Up to 5,000 most recent rows."
          icon={<FileSearch className="h-4 w-4" aria-hidden />}
          loading={busy === "audit"}
          onClick={downloadAudit}
        />
      </section>

      {isSuper ? (
        <Card className="border-[var(--color-warning)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert
                className="h-4 w-4 text-[var(--color-warning)]"
                aria-hidden
              />
              Emergency voter audit
            </CardTitle>
            <CardDescription>
              Per-voter lookup for security investigations only. Both the
              reason you give here and the fact that you ran the lookup are
              written to the audit log permanently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onEmergencyLookup} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="em-target">Target email</Label>
                <Input
                  id="em-target"
                  type="email"
                  placeholder="someone@student.usm.my"
                  value={emTarget}
                  onChange={(e) => setEmTarget(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="em-reason">Reason (recorded, min 10 chars)</Label>
                <Textarea
                  id="em-reason"
                  rows={2}
                  placeholder="e.g. user reported their account was used without consent — investigation #42"
                  value={emReason}
                  onChange={(e) => setEmReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={busy === "emergency"}>
                  Run emergency lookup
                </Button>
              </div>
            </form>

            {emResult ? (
              <div className="mt-6 grid gap-3 rounded-md border bg-[var(--color-muted)]/40 p-4 text-sm">
                <div>
                  <div className="font-medium">{emResult.target.fullName}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {emResult.target.email} · {emResult.target.matric} ·
                    profile{" "}
                    {emResult.target.profileComplete
                      ? "complete"
                      : "incomplete"}{" "}
                    · joined {emResult.target.createdAt}
                  </div>
                </div>
                <div className="grid gap-1 text-xs">
                  <div>
                    <strong>{emResult.voteCount}</strong> public vote(s)
                    recorded across all positions.
                  </div>
                  <div>
                    <strong>{emResult.evaluationCount}</strong> internal
                    evaluation row(s).
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <div className="text-xs font-medium">
                    Audit entries (up to 1000)
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-[var(--color-card)] text-left">
                          <th className="px-2 py-1.5 font-medium">When</th>
                          <th className="px-2 py-1.5 font-medium">Action</th>
                          <th className="px-2 py-1.5 font-medium">Entity</th>
                          <th className="px-2 py-1.5 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emResult.auditEntries.map((a, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-2 py-1 tabular-nums">
                              {a.createdAt}
                            </td>
                            <td className="px-2 py-1">{a.action}</td>
                            <td className="px-2 py-1">
                              {a.entityType}{" "}
                              {a.entityId ? `· ${a.entityId.slice(0, 8)}…` : ""}
                            </td>
                            <td className="px-2 py-1">{a.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadCsv(
                        emResult.auditEntries,
                        `emergency-${emResult.target.email}.csv`,
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Download CSV
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function ExportCard({
  title,
  description,
  icon,
  loading,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onClick} loading={loading}>
          <Download className="h-4 w-4" /> Download CSV
        </Button>
      </CardContent>
    </Card>
  );
}
