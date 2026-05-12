import type { Id } from "@/convex/_generated/dataModel";

export interface SessionRow {
  positionId: Id<"positions">;
  name: string;
  tier: number;
  order: number;
  sessionStatus: "pending" | "active" | "closed";
  sessionStartedAt: number | null;
  sessionClosedAt: number | null;
  voteCount: number;
  resultState: "previewed" | "published" | "manualTieResolved" | null;
  winnerCandidateId: Id<"candidates"> | null;
  hasUnresolvedTie: boolean;
}

export interface CandidateRef {
  _id: Id<"candidates">;
  fullName: string;
  matric: string | null;
}
