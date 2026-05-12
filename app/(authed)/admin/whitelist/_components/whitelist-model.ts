import type { Doc } from "@/convex/_generated/dataModel";

export const USM_DOMAIN = "@student.usm.my";

export type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

export const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

export const VOTER_CLASS_OPTIONS: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

export const VOTER_CLASS_TONE: Record<VoterClass, "brand" | "copper" | "muted"> = {
  topCommittee: "brand",
  headExecutive: "copper",
  year2Committee: "muted",
};

export const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export const WHITELIST_FALLBACK_PAGE_SIZE = 8;
export const WHITELIST_MIN_PAGE_SIZE = 1;
export const WHITELIST_ROW_HEIGHT = 60;
export const WHITELIST_BOTTOM_GUTTER = 48;

export interface BulkRow {
  displayRow: string;
  email: string;
  voterClass?: string;
}

export interface BulkIssue {
  displayRow: string;
  email: string;
  reason: string;
}

export interface BulkSummary {
  inserted: number;
  skipped: number;
  reclassified: number;
  errors: BulkIssue[];
  warnings: BulkIssue[];
}

export function isPlausibleUsmEmail(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length <= USM_DOMAIN.length) return false;
  if (!trimmed.endsWith(USM_DOMAIN)) return false;
  if (!/^[a-z0-9._-]+@student\.usm\.my$/i.test(trimmed)) return false;
  return true;
}
