import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export interface CandidateBreakdown {
  candidateId: Id<"candidates">;
  internalAvg: number;
  internalShare: number;
  publicVotes: number;
  publicShare: number;
  finalScore: number;
}

export interface ComputedResult {
  breakdown: CandidateBreakdown[];
  winnerCandidateId: Id<"candidates"> | null;
  tieGroup: Id<"candidates">[];
}

const RUBRIC_KEYS = [
  "leadership",
  "teamwork",
  "professionalism",
  "commitment",
  "personality",
] as const;

/**
 * Computes the 75/25 result for one position.
 *
 * - Eligible candidates are those assigned to this position and not
 *   already a winner of a higher / earlier position.
 * - Internal share: each candidate's mean rubric score is divided by
 *   the sum across eligible candidates in this position.
 * - Public share: candidate's vote count divided by the position's
 *   total votes among eligible candidates.
 * - Final = 0.75 * internalShare + 0.25 * publicShare.
 * - Tie ladder: highest finalScore -> highest internalAvg -> manual.
 */
export async function computeResultForPosition(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
  positionId: Id<"positions">,
  excludedCandidateIds: Set<string>,
): Promise<ComputedResult> {
  const links = await ctx.db
    .query("candidatePositions")
    .withIndex("by_position", (q) => q.eq("positionId", positionId))
    .collect();

  const eligibleIds = links
    .map((l) => l.candidateId)
    .filter((id) => !excludedCandidateIds.has(id));

  const submittedEvals = (
    await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", electionId))
      .collect()
  ).filter((e) => e.status === "submitted");
  const submittedEvalIds = new Set(submittedEvals.map((e) => e._id));

  const internalAvgByCandidate = new Map<string, number>();
  for (const candidateId of eligibleIds) {
    const allScores = await ctx.db
      .query("internalScores")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
      .collect();
    const filtered = allScores.filter((s) =>
      submittedEvalIds.has(s.evaluationId),
    );
    if (filtered.length === 0) {
      internalAvgByCandidate.set(candidateId, 0);
      continue;
    }
    let sum = 0;
    for (const s of filtered) {
      let perEvaluator = 0;
      for (const k of RUBRIC_KEYS) perEvaluator += s[k];
      sum += perEvaluator / RUBRIC_KEYS.length;
    }
    internalAvgByCandidate.set(candidateId, sum / filtered.length);
  }

  const publicVotesByCandidate = new Map<string, number>();
  const allVotes = await ctx.db
    .query("publicVotes")
    .withIndex("by_position", (q) => q.eq("positionId", positionId))
    .collect();
  for (const v of allVotes) {
    if (excludedCandidateIds.has(v.candidateId)) continue;
    publicVotesByCandidate.set(
      v.candidateId,
      (publicVotesByCandidate.get(v.candidateId) ?? 0) + 1,
    );
  }

  const sumInternal = Array.from(internalAvgByCandidate.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const sumPublic = Array.from(publicVotesByCandidate.values()).reduce(
    (a, b) => a + b,
    0,
  );

  const breakdown: CandidateBreakdown[] = eligibleIds.map((id) => {
    const internalAvg = internalAvgByCandidate.get(id) ?? 0;
    const publicVotes = publicVotesByCandidate.get(id) ?? 0;
    const internalShare = sumInternal > 0 ? internalAvg / sumInternal : 0;
    const publicShare = sumPublic > 0 ? publicVotes / sumPublic : 0;
    const finalScore = 0.75 * internalShare + 0.25 * publicShare;
    return {
      candidateId: id as Id<"candidates">,
      internalAvg,
      internalShare,
      publicVotes,
      publicShare,
      finalScore,
    };
  });

  if (breakdown.length === 0) {
    return { breakdown, winnerCandidateId: null, tieGroup: [] };
  }

  const sorted = breakdown.slice().sort((a, b) => b.finalScore - a.finalScore);
  const top = sorted[0];
  if (!top) {
    return { breakdown, winnerCandidateId: null, tieGroup: [] };
  }
  const tiedFinal = sorted.filter((b) =>
    Math.abs(b.finalScore - top.finalScore) < 1e-9,
  );

  if (tiedFinal.length === 1) {
    return {
      breakdown,
      winnerCandidateId: top.candidateId,
      tieGroup: [],
    };
  }

  const tiedSorted = tiedFinal
    .slice()
    .sort((a, b) => b.internalAvg - a.internalAvg);
  const topInternal = tiedSorted[0];
  if (!topInternal) {
    return { breakdown, winnerCandidateId: null, tieGroup: [] };
  }
  const tiedAfterInternal = tiedSorted.filter(
    (b) => Math.abs(b.internalAvg - topInternal.internalAvg) < 1e-9,
  );

  if (tiedAfterInternal.length === 1) {
    return {
      breakdown,
      winnerCandidateId: topInternal.candidateId,
      tieGroup: [],
    };
  }

  return {
    breakdown,
    winnerCandidateId: null,
    tieGroup: tiedAfterInternal.map((b) => b.candidateId),
  };
}

export async function getResolvedWinnerCandidateIds(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<Set<string>> {
  const results = await ctx.db
    .query("results")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  const winners = new Set<string>();
  for (const r of results) {
    if (r.winnerCandidateId) winners.add(r.winnerCandidateId);
  }
  return winners;
}

export async function getUnresolvedTiePositionIds(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<Id<"positions">[]> {
  const results = await ctx.db
    .query("results")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  return results
    .filter((r) => r.winnerCandidateId === undefined)
    .map((r) => r.positionId);
}
