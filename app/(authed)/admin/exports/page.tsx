"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  FileSearch,
  FileSpreadsheet,
  ShieldAlert,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { downloadCsv } from "@/lib/csv";
import { formatMYT, formatMYTFilenameStamp } from "@/lib/format";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";

type Phase = Doc<"elections">["phase"];

const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

type ExportKind =
  | "internal"
  | "internalByClass"
  | "publicCounts"
  | "combined"
  | "participation"
  | "audit";

interface ExportSpec {
  kind: ExportKind;
  technique: "Roster" | "Results" | "Audit";
  title: string;
  body: string;
  filenameStem: string;
  icon: ReactNode;
}

const EXPORT_SPECS: ExportSpec[] = [
  {
    kind: "internal",
    technique: "Roster",
    title: "Internal rubric scores",
    body: "Per evaluator, per candidate, per criterion. Includes draft and submitted rows, voter class column, and the configured max score for each row.",
    filenameStem: "internal-scores",
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden />,
  },
  {
    kind: "internalByClass",
    technique: "Roster",
    title: "Internal scores by class",
    body: "Aggregated per voter class and candidate: evaluator count, sum of totals, class share, and weighted contribution. Used for AGM minutes and tie-break review.",
    filenameStem: "internal-by-class",
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden />,
  },
  {
    kind: "publicCounts",
    technique: "Results",
    title: "Public vote counts",
    body: "Per position and candidate vote totals. No per-voter detail, so privacy is preserved on archive.",
    filenameStem: "public-counts",
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden />,
  },
  {
    kind: "combined",
    technique: "Results",
    title: "Combined results",
    body: "The weighted output for every position: per-class shares (TC, HE, Y2), public share, internal aggregate, public aggregate, final score, winner flag, and tie-break step where applicable.",
    filenameStem: "combined-results",
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden />,
  },
  {
    kind: "participation",
    technique: "Roster",
    title: "Participation",
    body: "Per voter snapshot: completed profile, internal evaluator status, evaluation status, and which positions they voted on.",
    filenameStem: "participation",
    icon: <Users className="h-4 w-4" aria-hidden />,
  },
  {
    kind: "audit",
    technique: "Audit",
    title: "Audit log",
    body: "Every privileged action with timestamp, actor email, action, entity, and reason. Up to 5,000 most recent rows; older rows must be queried directly from Convex.",
    filenameStem: "audit-log",
    icon: <FileSearch className="h-4 w-4" aria-hidden />,
  },
];

const TECHNIQUE_TONE: Record<ExportSpec["technique"], "brand" | "copper" | "muted"> = {
  Roster: "muted",
  Results: "brand",
  Audit: "copper",
};

function safeCycleSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");
}

function buildFilename(stem: string, slug: string, now: number): string {
  return `${slug}-${stem}-${formatMYTFilenameStamp(now)}.csv`;
}

export default function ExportsPage() {
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
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const convex = useConvex();

  const [busy, setBusy] = useState<ExportKind | null>(null);

  const isSuper = adminStatus?.role === "super";
  const slug = safeCycleSlug(election.name) || "agm";

  const onExport = async (spec: ExportSpec) => {
    setBusy(spec.kind);
    const now = Date.now();
    try {
      const rows = await runExportQuery(convex, spec.kind, election._id);
      const filename = buildFilename(spec.filenameStem, slug, now);
      if (rows.length === 0) {
        toast.warning("No rows to export", {
          description: `${spec.title} is empty for ${election.name}. The CSV file would be blank, so the download was skipped.`,
        });
        return;
      }
      downloadCsv(rows, filename);
      toast.success(`${spec.title} downloaded`, {
        description: `${rows.length} ${rows.length === 1 ? "row" : "rows"} written to ${filename}.`,
      });
    } catch (err) {
      toast.error(`${spec.title} export failed`, {
        description: getConvexErrorMessage(err, "Export failed."),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="container-wide space-y-12 py-12">
      <AdminBreadcrumb items={[{ label: "Exports" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Exports"
          secondary={election.name}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          CSV downloads and emergency audit lookup
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Every download is named with the cycle slug and an MYT timestamp
          so two operators on different laptops produce filenames that
          sort the same way. Use these for council minutes, post-mortems,
          and the public results archive. The emergency voter audit at
          the bottom of this page is the only privileged read; treat it
          like the publish step on results.
        </p>
        <MetaGroup className="grid-cols-2 sm:grid-cols-3">
          <Meta label="Cycle" value={election.name} />
          <Meta label="Phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="Available exports" value={EXPORT_SPECS.length} />
        </MetaGroup>
      </header>

      <section
        aria-label="Standard CSV exports"
        className="space-y-4"
      >
        <header>
          <SectionMarker
            primary="Standard exports"
            secondary="One CSV per artefact"
          />
        </header>
        <ol className="space-y-0" aria-label="Standard CSV exports">
          {EXPORT_SPECS.map((spec, index) => (
            <li key={spec.kind}>
              <ExportItem
                spec={spec}
                index={index}
                loading={busy === spec.kind}
                onClick={() => void onExport(spec)}
              />
            </li>
          ))}
        </ol>
      </section>

      {isSuper ? (
        <EmergencyAuditPanel
          electionSlug={slug}
        />
      ) : null}
    </main>
  );
}

function ExportItem({
  spec,
  index,
  loading,
  onClick,
}: {
  spec: ExportSpec;
  index: number;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <article className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-[var(--ink-line)] py-6">
      <span
        className="font-mono text-xl font-medium tabular-nums text-[var(--ink-muted)]"
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionMarker primary={spec.technique} />
          <span aria-hidden className="text-[var(--ink-muted)]">
            {spec.icon}
          </span>
          <h2 className="font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-xl">
            {spec.title}
          </h2>
          <Badge tone={TECHNIQUE_TONE[spec.technique]}>{spec.technique}</Badge>
        </div>
        <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {spec.body}
        </p>
      </div>
      <div>
        <Button onClick={onClick} loading={loading} variant="outline" size="sm">
          <Download className="h-4 w-4" aria-hidden /> Download CSV
        </Button>
      </div>
    </article>
  );
}

interface AuditEntry {
  createdAt: number;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  payload: string;
}

interface EmergencyAuditResult {
  target: {
    email: string;
    fullName: string;
    matric: string;
    profileComplete: boolean;
    createdAt: number;
  };
  auditEntries: AuditEntry[];
  voteCount: number;
  evaluationCount: number;
}

const REASON_MIN = 10;

function EmergencyAuditPanel({ electionSlug }: { electionSlug: string }) {
  const dialog = useDialog();
  const emergencyVoterAudit = useMutation(api.exports.emergencyVoterAudit);

  const targetId = useId();
  const reasonId = useId();
  const reasonHintId = useId();
  const targetErrId = useId();
  const reasonErrId = useId();

  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    target: string | null;
    reason: string | null;
  }>({ target: null, reason: null });
  const [result, setResult] = useState<EmergencyAuditResult | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedTarget = target.trim().toLowerCase();
    const trimmedReason = reason.trim();

    const nextErrors = {
      target:
        trimmedTarget.length === 0
          ? "Enter the voter's email address."
          : !trimmedTarget.endsWith("@student.usm.my")
            ? "Email must end in @student.usm.my."
            : null,
      reason:
        trimmedReason.length < REASON_MIN
          ? `Reason must be at least ${REASON_MIN} characters. The reason is recorded in the audit log.`
          : null,
    };
    setErrors(nextErrors);
    if (nextErrors.target || nextErrors.reason) return;

    const ok = await dialog.confirm({
      title: "Run emergency voter audit?",
      description: (
        <>
          This reveals every public-vote choice and every internal
          evaluation row for{" "}
          <strong className="font-semibold">{trimmedTarget}</strong>{" "}
          across every position in this cycle, plus every audit entry
          that names them. Your reason and your account are written to
          the audit log permanently and are reviewable by every super
          admin. Use this only when an investigation requires it.
        </>
      ),
      confirmText: "Reveal voter ballot",
      variant: "destructive",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const data = await emergencyVoterAudit({
        targetEmail: trimmedTarget,
        reason: trimmedReason,
      });
      setResult(data);
      toast.success("Lookup recorded", {
        description: `${data.auditEntries.length} audit ${data.auditEntries.length === 1 ? "entry" : "entries"} returned. The lookup itself is now in the audit log.`,
      });
    } catch (err) {
      toast.error("Lookup failed", {
        description: getConvexErrorMessage(err, "Lookup failed."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onDownloadCsv = async () => {
    if (!result) return;
    const ok = await dialog.confirm({
      title: "Download voter audit CSV?",
      description: (
        <>
          Save the ballot and audit history for{" "}
          <strong className="font-semibold">{result.target.email}</strong>
          {" "}to a CSV file on this device. Once
          downloaded, the file is no longer protected by the portal; treat
          it like any other piece of personal data and delete the local
          copy when the investigation closes.
        </>
      ),
      confirmText: "Download CSV",
      variant: "destructive",
    });
    if (!ok) return;
    const filename = buildFilename(
      `emergency-${safeCycleSlug(result.target.email) || "voter"}`,
      electionSlug,
      Date.now(),
    );
    const rows = result.auditEntries.map((a) => ({
      createdAt: formatMYT(a.createdAt),
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      reason: a.reason,
      payload: a.payload,
    }));
    downloadCsv(rows, filename);
    toast.success("Audit CSV downloaded", {
      description: `${rows.length} ${rows.length === 1 ? "row" : "rows"} written to ${filename}.`,
    });
  };

  return (
    <NoticeStrip
      markerPrimary="Emergency voter audit"
      markerSecondary="Super admin only"
      markerIcon={
        <ShieldAlert
          className="h-4 w-4 text-[var(--color-destructive)]"
          aria-hidden
        />
      }
      headline="Reveal one voter's ballot, by reason and on the record"
      tone="destructive"
      role="alert"
    >
      <div className="space-y-4">
        <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Almost never used. When an investigation requires linking a
          voter to their public-vote choices, run this and accept that
          the action is permanently logged with your reason and is
          reviewable by every super admin. The system blocks reasons
          shorter than {REASON_MIN} characters so the log carries
          something a future reader can act on.
        </p>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor={targetId}>Target voter email</Label>
            <Input
              id={targetId}
              type="email"
              placeholder="someone@student.usm.my"
              autoComplete="off"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (errors.target) {
                  setErrors((prev) => ({ ...prev, target: null }));
                }
              }}
              aria-required="true"
              aria-invalid={errors.target ? "true" : undefined}
              aria-describedby={errors.target ? targetErrId : undefined}
            />
            {errors.target ? (
              <p
                id={targetErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {errors.target}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={reasonId}>Investigation reason</Label>
            <Textarea
              id={reasonId}
              rows={3}
              placeholder="e.g. voter reported their account was used without consent, investigation 42 with the AGM chair"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errors.reason) {
                  setErrors((prev) => ({ ...prev, reason: null }));
                }
              }}
              aria-required="true"
              aria-invalid={errors.reason ? "true" : undefined}
              aria-describedby={
                errors.reason ? reasonErrId : reasonHintId
              }
            />
            <p
              id={reasonHintId}
              className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]"
            >
              Minimum {REASON_MIN} characters. This is what the next
              super admin will read when they review the log.
            </p>
            {errors.reason ? (
              <p
                id={reasonErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {errors.reason}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--ink-line)] pt-4">
            <Button
              type="submit"
              variant="destructive"
              loading={submitting}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden /> Reveal voter ballot
            </Button>
          </div>
        </form>

        {result ? (
          <EmergencyResultPanel
            result={result}
            onDownload={() => void onDownloadCsv()}
            onDismiss={() => setResult(null)}
          />
        ) : null}
      </div>
    </NoticeStrip>
  );
}

function EmergencyResultPanel({
  result,
  onDownload,
  onDismiss,
}: {
  result: EmergencyAuditResult;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-label="Emergency voter audit result"
      className="space-y-4 border-t border-[var(--color-destructive)] pt-5"
    >
      <header className="space-y-2">
        <SectionMarker
          primary="Lookup result"
          secondary={
            <>
              {result.auditEntries.length}{" "}
              {result.auditEntries.length === 1 ? "audit row" : "audit rows"}
              {" "}
              <span aria-hidden className="text-[var(--copper)]">
                ·
              </span>{" "}
              {result.voteCount} public{" "}
              {result.voteCount === 1 ? "vote" : "votes"}
            </>
          }
        />
        <h3 className="font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink)]">
          {result.target.fullName.length > 0
            ? result.target.fullName
            : result.target.email}
        </h3>
        <p className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
          {result.target.email}
          <span aria-hidden className="px-1 text-[var(--copper)]">
            ·
          </span>
          {result.target.matric.length > 0
            ? result.target.matric
            : "no matric"}
          <span aria-hidden className="px-1 text-[var(--copper)]">
            ·
          </span>
          profile{" "}
          {result.target.profileComplete ? "complete" : "incomplete"}
          <span aria-hidden className="px-1 text-[var(--copper)]">
            ·
          </span>
          joined {formatMYT(result.target.createdAt)}
        </p>
      </header>

      <MetaGroup className="grid-cols-2 sm:grid-cols-3">
        <Meta label="Audit entries" value={result.auditEntries.length} />
        <Meta label="Public votes" value={result.voteCount} />
        <Meta label="Internal evaluations" value={result.evaluationCount} />
      </MetaGroup>

      {result.auditEntries.length === 0 ? (
        <p
          className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink-muted)]"
          role="note"
        >
          No audit log entries reference this voter. The lookup itself is
          recorded.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--ink-line)] text-left">
                <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                  When (MYT)
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                  Action
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                  Entity
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {result.auditEntries.map((a, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--ink-line)] last:border-b-0"
                >
                  <td className="px-3 py-1.5 font-mono tabular-nums text-[var(--ink)]">
                    {formatMYT(a.createdAt)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--ink)]">
                    {a.action}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--ink-muted)]">
                    {a.entityType}
                    {a.entityId
                      ? ` · ${a.entityId.slice(0, 8)}…`
                      : ""}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--ink)]">
                    {a.reason || (
                      <span className="text-[var(--ink-muted)]">
                        (no reason)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Download
          audit CSV
        </Button>
      </div>
    </section>
  );
}

async function runExportQuery(
  convex: ReturnType<typeof useConvex>,
  kind: ExportKind,
  electionId: Doc<"elections">["_id"],
): Promise<Record<string, unknown>[]> {
  switch (kind) {
    case "internal":
      return await convex.query(api.exports.internalScores, { electionId });
    case "internalByClass":
      return await convex.query(api.exports.internalScoresByClass, {
        electionId,
      });
    case "publicCounts":
      return await convex.query(api.exports.publicCounts, { electionId });
    case "combined":
      return await convex.query(api.exports.combined, { electionId });
    case "participation":
      return await convex.query(api.exports.participation, { electionId });
    case "audit":
      return await convex.query(api.exports.auditLog, {});
  }
}
