import type { ReactNode } from "react";
import { useConvex } from "convex/react";
import { FileSearch, FileSpreadsheet, Users } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { formatMYTFilenameStamp } from "@/lib/format";
import type { Doc } from "@/convex/_generated/dataModel";

export type Phase = Doc<"elections">["phase"];

export const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export type ExportKind =
  | "internal"
  | "internalByClass"
  | "publicCounts"
  | "combined"
  | "participation"
  | "audit";

export interface ExportSpec {
  kind: ExportKind;
  technique: "Roster" | "Results" | "Audit";
  title: string;
  body: string;
  filenameStem: string;
  icon: ReactNode;
}

export const EXPORT_SPECS: ExportSpec[] = [
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

export const TECHNIQUE_TONE: Record<ExportSpec["technique"], "brand" | "copper" | "muted"> = {
  Roster: "muted",
  Results: "brand",
  Audit: "copper",
};

export function safeCycleSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");
}

export function buildFilename(stem: string, slug: string, now: number): string {
  return `${slug}-${stem}-${formatMYTFilenameStamp(now)}.csv`;
}

export async function runExportQuery(
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
