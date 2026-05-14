import type { Doc, Id } from "@/convex/_generated/dataModel";

export const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export const ROSTER_FALLBACK_PAGE_SIZE = 6;
export const ROSTER_MIN_ROWS = 1;
export const ROSTER_CARD_ROW_HEIGHT = 158;
export const ROSTER_BOTTOM_GUTTER = 48;
export const ROSTER_DESKTOP_COLUMNS = 2;
export const ROSTER_MOBILE_COLUMNS = 1;

export type RosterSort = "name" | "position";

export const ROSTER_SORTS: {
  value: RosterSort;
  label: string;
  summary: string;
}[] = [
  { value: "name", label: "Name", summary: "Sorted by name" },
  { value: "position", label: "Position", summary: "Sorted by position" },
];
export const DEFAULT_ROSTER_SORT = ROSTER_SORTS[0]!;

export interface CandidateRow {
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
    order: number;
    fallbackOrder: number;
  }[];
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

