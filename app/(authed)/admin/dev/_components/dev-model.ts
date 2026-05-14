import type { Doc } from "@/convex/_generated/dataModel";

export type Distribution = "uniform" | "perfect" | "favorFirst";
export type VoteTallyKind = "uniform" | "favorFirst";

export const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  uniform: "Uniform random (seeded, deterministic)",
  perfect: "Perfect: all max scores",
  favorFirst: "Favor first candidate (high vs low)",
};

export const TALLY_LABEL: Record<VoteTallyKind, string> = {
  uniform: "Even split",
  favorFirst: "Favor first candidate (~70%)",
};

export const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};
