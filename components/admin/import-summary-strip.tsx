import * as React from "react";
import { AlertTriangle, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NoticeStrip } from "@/components/ui/notice-strip";

/**
 * `<ImportSummaryStrip>` is the per-row import summary block the admin
 * tree shows after a CSV upload or pasted-input import: a stat row
 * (Added / Reclassified / Skipped / Errors / Warnings), two scrollable
 * issue lists with row labels, and a dismiss control. Tier 3 of the
 * audit-and-rework sweep flagged the pattern as inlined twice — once
 * in `app/(authed)/admin/whitelist/page.tsx` (CSV + paste) and once
 * in `app/(authed)/admin/candidates/page.tsx` (CSV) — and Tier 4's
 * `/admin/exports` will need the same shape for export-failure
 * summaries (an export is just a reverse import: same per-row error
 * vocabulary applies). Consolidating now prevents the third drift.
 *
 * Internal composition:
 * - Outer is a `<NoticeStrip>` (the Tier 2 primitive), so the section
 *   marker, headline, copper border, and `--paper-2` ground come from
 *   the canonical surface. We never restyle that primitive from here.
 * - The marker icon is auto-derived: `<FileWarning>` in copper if the
 *   summary carries any errors or warnings, omitted on a clean run.
 * - `<dl>` of partial stats: only keys whose value is a number render,
 *   so the candidate import (no "Reclassified", no "Warnings") drops
 *   those cells entirely instead of showing a misleading zero.
 * - Two scrollable issue lists. The error reason renders in copper to
 *   telegraph "this row needs action"; the warning reason stays in
 *   `--ink-muted` so warnings read as "informational, no fix
 *   required". Match this distinction in any future caller — do not
 *   invent a third reason-color.
 * - A trailing ghost-button "Dismiss" matches the placement of both
 *   inlined originals.
 *
 * The Errors and Warnings list section labels render with colons
 * ("Errors: these rows did not import" / "Warnings: imported with a
 * fallback"), per the DESIGN.md em-dash ban. The closeout copy sweep
 * resolved the previously-deferred em-dash variant.
 */

export interface ImportSummaryEntry {
  /** Caller-formatted source-row label, e.g. "Row 12" or "Line 3, item 2". */
  displayRow: string;
  /**
   * Optional row identifier rendered between displayRow and reason.
   * The whitelist import carries the email here; the candidate CSV
   * import has no per-row identifier and omits this field, dropping
   * the middle column from the rendered list row.
   */
  email?: string;
  /** One-line plain-English reason. Plain text only, no markup. */
  reason: string;
}

type ImportSummaryTone = "copper" | "destructive" | "neutral";

export interface ImportSummaryStripProps {
  /** Section marker primary line, e.g. "Last bulk import". */
  markerPrimary: string;
  /** Section marker secondary line, e.g. file name or paste source. */
  markerSecondary?: string;
  /** Display headline rendered below the marker. */
  headline: string;
  /**
   * Per-summary stat counts. Only keys whose value is a number render
   * as <dt>/<dd> cells. Absent keys do not render — callers should not
   * pass `0` just to fill the grid; absent means "this concept does
   * not apply here", not "this concept ran zero times".
   */
  stats: {
    added?: number;
    reclassified?: number;
    skipped?: number;
    errors?: number;
    warnings?: number;
  };
  /** Per-row error entries. Renders the "Errors" list when non-empty. */
  errors?: ReadonlyArray<ImportSummaryEntry>;
  /** Per-row warning entries. Renders the "Warnings" list when non-empty. */
  warnings?: ReadonlyArray<ImportSummaryEntry>;
  /** Dismiss handler invoked by the trailing "Dismiss" button. */
  onDismiss: () => void;
  /**
   * Tone passed through to the underlying NoticeStrip border accent.
   * If omitted, defaults to `"destructive"` when `errors` is non-empty
   * and `"copper"` otherwise — matching the user-spec direction for
   * Tier 4 export-failure summaries. Existing callers pass the tone
   * explicitly to preserve their current copper/neutral split.
   */
  tone?: ImportSummaryTone;
}

export function ImportSummaryStrip({
  markerPrimary,
  markerSecondary,
  headline,
  stats,
  errors,
  warnings,
  onDismiss,
  tone,
}: ImportSummaryStripProps) {
  const errorCount = errors?.length ?? 0;
  const warningCount = warnings?.length ?? 0;
  const totalIssues = errorCount + warningCount;
  const resolvedTone: ImportSummaryTone =
    tone ?? (errorCount > 0 ? "destructive" : "copper");

  return (
    <NoticeStrip
      markerPrimary={markerPrimary}
      markerSecondary={markerSecondary}
      markerIcon={
        totalIssues > 0 ? (
          <FileWarning
            className="h-4 w-4 text-[var(--copper)]"
            aria-hidden
          />
        ) : undefined
      }
      headline={headline}
      tone={resolvedTone}
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.added !== undefined ? (
          <SummaryStat label="Added" value={stats.added} />
        ) : null}
        {stats.reclassified !== undefined ? (
          <SummaryStat label="Reclassified" value={stats.reclassified} />
        ) : null}
        {stats.skipped !== undefined ? (
          <SummaryStat label="Skipped" value={stats.skipped} />
        ) : null}
        {stats.errors !== undefined ? (
          <SummaryStat label="Errors" value={stats.errors} />
        ) : null}
        {stats.warnings !== undefined ? (
          <SummaryStat label="Warnings" value={stats.warnings} />
        ) : null}
      </dl>

      {errorCount > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--copper)]">
            <AlertTriangle
              className="mr-1 inline-block h-3 w-3"
              aria-hidden
            />{" "}
            Errors: these rows did not import
          </p>
          <IssueList entries={errors!} reasonClass="text-[var(--copper)]" />
        </div>
      ) : null}

      {warningCount > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Warnings: imported with a fallback
          </p>
          <IssueList
            entries={warnings!}
            reasonClass="text-[var(--ink-muted)]"
          />
        </div>
      ) : null}

      <div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </NoticeStrip>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {label}
      </dt>
      <dd className="font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
        {value}
      </dd>
    </div>
  );
}

function IssueList({
  entries,
  reasonClass,
}: {
  entries: ReadonlyArray<ImportSummaryEntry>;
  reasonClass: string;
}) {
  return (
    <ul className="max-h-48 space-y-1.5 overflow-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-3 font-mono text-xs">
      {entries.map((entry, i) => (
        <li key={i} className="flex flex-wrap gap-2">
          <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
            {entry.displayRow}
          </span>
          {entry.email ? (
            <span className="text-[var(--ink)]">{entry.email}</span>
          ) : null}
          <span className={reasonClass}>{entry.reason}</span>
        </li>
      ))}
    </ul>
  );
}
