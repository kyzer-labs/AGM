import type { Id } from "@/convex/_generated/dataModel";

export const PHASE_LABELS: Record<string, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation",
  internalClosed: "Internal closed",
  publicVoting: "Public voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export interface PreviewBreakdown {
  candidateId: Id<"candidates">;
  fullName: string;
  matric: string;
  photoUrl: string | null;
  tcShare: number;
  heShare: number;
  y2Share: number;
  publicVotes: number;
  publicShare: number;
  internalAggregate: number;
  publicAggregate: number;
  finalScore: number;
}

export interface PreviewRow {
  positionId: Id<"positions">;
  positionName: string;
  tier: number;
  order: number;
  state: "previewed" | "published" | "manualTieResolved" | null;
  winnerCandidateId: Id<"candidates"> | null;
  winnerName: string | null;
  hasUnresolvedTie: boolean;
  tieBreakStep: string | null;
  manualResolutionReason: string | null;
  publishedAt: number | null;
  totalPublicVotes: number;
  weights: {
    topCommittee: number;
    headExecutive: number;
    year2Committee: number;
    public: number;
  };
  breakdown: PreviewBreakdown[];
}

export const TIE_STEP_LABELS: Record<string, string> = {
  finalScore: "Final score",
  tcShare: "Top Committee share",
  heShare: "Head Executive share",
  y2Share: "Year 2 Committee share",
  publicShare: "Public vote share",
  internalShare: "Internal share (legacy)",
  manual: "Manual decision",
};
