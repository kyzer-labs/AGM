"use client";

import { useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/csv";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { buildFilename, safeCycleSlug } from "./exports-model";

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

export function EmergencyAuditPanel({ electionSlug }: { electionSlug: string }) {
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
