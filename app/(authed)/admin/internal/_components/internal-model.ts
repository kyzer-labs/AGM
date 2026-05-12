import type { Doc } from "@/convex/_generated/dataModel";

export type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

export const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

export const VOTER_CLASSES: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

export type Phase = Doc<"elections">["phase"];

export const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export const PHASE_TONE: Record<
  Phase,
  "brand" | "success" | "warning" | "muted" | "copper"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "muted",
  publicVoting: "brand",
  resultsPreview: "copper",
  published: "success",
};
