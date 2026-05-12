import { ImportSummaryStrip } from "@/components/admin/import-summary-strip";
import type { BulkSummary } from "./whitelist-model";

export function BulkImportSummary({
  summary,
  onDismiss,
}: {
  summary: BulkSummary & { attempted: number; sourceLabel: string };
  onDismiss: () => void;
}) {
  const totalIssues = summary.errors.length + summary.warnings.length;
  return (
    <ImportSummaryStrip
      markerPrimary="Last bulk import"
      markerSecondary={summary.sourceLabel}
      headline={`${summary.inserted} of ${summary.attempted} ${
        summary.attempted === 1 ? "row" : "rows"
      } imported`}
      stats={{
        added: summary.inserted,
        reclassified: summary.reclassified,
        skipped: summary.skipped,
        errors: summary.errors.length,
        warnings: summary.warnings.length,
      }}
      errors={summary.errors}
      warnings={summary.warnings}
      tone={totalIssues > 0 ? "copper" : "neutral"}
      onDismiss={onDismiss}
    />
  );
}
