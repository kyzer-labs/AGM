import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type ElectionPhase = Doc<"elections">["phase"];

export const PHASE_LABEL: Record<ElectionPhase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const ALLOWED_TRANSITIONS: Record<ElectionPhase, ElectionPhase[]> = {
  setup: ["internalOpen"],
  internalOpen: ["internalClosed", "setup"],
  internalClosed: ["publicVoting", "internalOpen"],
  publicVoting: ["resultsPreview", "internalClosed"],
  resultsPreview: ["published", "publicVoting"],
  published: [],
};

export function canTransition(
  from: ElectionPhase,
  to: ElectionPhase,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export async function getElectionOrThrow(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<Doc<"elections">> {
  const e = await ctx.db.get(electionId);
  if (!e) throw new ConvexError("Election not found.");
  return e;
}

export async function requireSetupPhase(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<Doc<"elections">> {
  const e = await getElectionOrThrow(ctx, electionId);
  if (e.phase !== "setup") {
    throw new ConvexError(
      `This action is only allowed during the Setup phase. Current phase: ${PHASE_LABEL[e.phase]}.`,
    );
  }
  return e;
}

export interface SetupReadiness {
  ready: boolean;
  positionsCount: number;
  candidatesCount: number;
  whitelistCount: number;
  unassignedCandidates: number;
  positionsWithoutCandidates: number;
  warnings: string[];
}

export async function computeSetupReadiness(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<SetupReadiness> {
  const positions = await ctx.db
    .query("positions")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();

  const candidates = await ctx.db
    .query("candidates")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();

  const whitelist = await ctx.db
    .query("internalWhitelist")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();

  const candidatePositionsByCandidate = new Map<
    string,
    Doc<"candidatePositions">[]
  >();
  const candidatePositionsByPosition = new Map<
    string,
    Doc<"candidatePositions">[]
  >();

  for (const c of candidates) {
    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
      .collect();
    candidatePositionsByCandidate.set(c._id, links);
    for (const link of links) {
      const arr = candidatePositionsByPosition.get(link.positionId) ?? [];
      arr.push(link);
      candidatePositionsByPosition.set(link.positionId, arr);
    }
  }

  const unassignedCandidates = candidates.filter(
    (c) => (candidatePositionsByCandidate.get(c._id) ?? []).length === 0,
  ).length;
  const positionsWithoutCandidates = positions.filter(
    (p) => (candidatePositionsByPosition.get(p._id) ?? []).length === 0,
  ).length;

  const warnings: string[] = [];
  if (positions.length === 0) warnings.push("No positions configured.");
  if (candidates.length === 0) warnings.push("No candidates added.");
  if (whitelist.length === 0)
    warnings.push("Year 2 internal whitelist is empty.");
  if (unassignedCandidates > 0)
    warnings.push(
      `${unassignedCandidates} candidate(s) are not assigned to any position.`,
    );
  if (positionsWithoutCandidates > 0)
    warnings.push(
      `${positionsWithoutCandidates} position(s) have no candidates.`,
    );

  const ready =
    positions.length > 0 &&
    candidates.length > 0 &&
    whitelist.length > 0 &&
    unassignedCandidates === 0 &&
    positionsWithoutCandidates === 0;

  return {
    ready,
    positionsCount: positions.length,
    candidatesCount: candidates.length,
    whitelistCount: whitelist.length,
    unassignedCandidates,
    positionsWithoutCandidates,
    warnings,
  };
}
