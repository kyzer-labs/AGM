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

export const PHASE_TONES: Record<
  Phase,
  "neutral" | "brand" | "success" | "warning" | "muted"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "neutral",
  publicVoting: "brand",
  resultsPreview: "warning",
  published: "success",
};

export const NEXT_PHASE_LABEL: Partial<Record<Phase, { to: Phase; label: string }>> = {
  setup: { to: "internalOpen", label: "Open internal evaluation" },
  internalOpen: { to: "internalClosed", label: "Close internal evaluation" },
  internalClosed: { to: "publicVoting", label: "Start public voting" },
  publicVoting: { to: "resultsPreview", label: "Move to results preview" },
  resultsPreview: { to: "published", label: "Publish results" },
};
