import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getEntryClass,
  getWeights,
  type CycleWeights,
  type VoterClass,
} from "./cycle";
import { getElectionOrThrow } from "./setup";

export interface CandidateBreakdown {
  candidateId: Id<"candidates">;
  tcShare: number;
  heShare: number;
  y2Share: number;
  publicVotes: number;
  publicShare: number;
  internalAggregate: number;
  publicAggregate: number;
  finalScore: number;
}

export type TieBreakStep =
  | "finalScore"
  | "tcShare"
  | "heShare"
  | "y2Share"
  | "publicShare"
  | "manual";

export interface ComputedResult {
  breakdown: CandidateBreakdown[];
  winnerCandidateId: Id<"candidates"> | null;
  tieGroup: Id<"candidates">[];
  tieBreakStep: TieBreakStep;
  weights: CycleWeights;
}

const EPS = 1e-9;

async function buildEvaluatorClassMap(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
): Promise<Map<Id<"internalEvaluations">, VoterClass>> {
  const evals = await ctx.db
    .query("internalEvaluations")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  const submitted = evals.filter((e) => e.status === "submitted");

  const map = new Map<Id<"internalEvaluations">, VoterClass>();
  for (const ev of submitted) {
    const voter = await ctx.db.get(ev.evaluatorVoterId);
    if (!voter) continue;
    const wl = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election_email", (q) =>
        q.eq("electionId", electionId).eq("email", voter.email),
      )
      .unique();
    if (!wl) continue;
    map.set(ev._id, getEntryClass(wl));
  }
  return map;
}

function shareForCandidate(
  cls: VoterClass,
  breakdown: CandidateBreakdown,
): number {
  if (cls === "topCommittee") return breakdown.tcShare;
  if (cls === "headExecutive") return breakdown.heShare;
  return breakdown.y2Share;
}

export async function computeResultForPosition(
  ctx: QueryCtx | MutationCtx,
  electionId: Id<"elections">,
  positionId: Id<"positions">,
  excludedCandidateIds: Set<string>,
): Promise<ComputedResult> {
  const election = await getElectionOrThrow(ctx, electionId);
  const weights = getWeights(election);

  const links = await ctx.db
    .query("candidatePositions")
    .withIndex("by_position", (q) => q.eq("positionId", positionId))
    .collect();

  const eligibleIds = links
    .map((l) => l.candidateId)
    .filter((id) => !excludedCandidateIds.has(id));

  const eligibleSet = new Set<string>(eligibleIds);

  const evalClassMap = await buildEvaluatorClassMap(ctx, electionId);

  const classCandidateSum: Record<VoterClass, Map<string, number>> = {
    topCommittee: new Map(),
    headExecutive: new Map(),
    year2Committee: new Map(),
  };
  const classGrandTotal: Record<VoterClass, number> = {
    topCommittee: 0,
    headExecutive: 0,
    year2Committee: 0,
  };

  for (const [evalId, cls] of evalClassMap.entries()) {
    const scores = await ctx.db
      .query("internalScores")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", evalId))
      .collect();

    const perCandidateTotal = new Map<string, number>();
    for (const s of scores) {
      if (!eligibleSet.has(s.candidateId)) continue;
      if (s.criterionId === undefined || s.score === undefined) continue;
      perCandidateTotal.set(
        s.candidateId,
        (perCandidateTotal.get(s.candidateId) ?? 0) + s.score,
      );
    }

    for (const [candidateId, total] of perCandidateTotal.entries()) {
      classCandidateSum[cls].set(
        candidateId,
        (classCandidateSum[cls].get(candidateId) ?? 0) + total,
      );
      classGrandTotal[cls] += total;
    }
  }

  const allVotes = await ctx.db
    .query("publicVotes")
    .withIndex("by_position", (q) => q.eq("positionId", positionId))
    .collect();

  const publicVotesByCandidate = new Map<string, number>();
  let publicTotal = 0;
  for (const vote of allVotes) {
    if (!eligibleSet.has(vote.candidateId)) continue;
    publicVotesByCandidate.set(
      vote.candidateId,
      (publicVotesByCandidate.get(vote.candidateId) ?? 0) + 1,
    );
    publicTotal += 1;
  }

  const wTc = weights.topCommittee / 100;
  const wHe = weights.headExecutive / 100;
  const wY2 = weights.year2Committee / 100;
  const wPub = weights.public / 100;

  const breakdown: CandidateBreakdown[] = eligibleIds.map((id) => {
    const tcSum = classCandidateSum.topCommittee.get(id) ?? 0;
    const heSum = classCandidateSum.headExecutive.get(id) ?? 0;
    const y2Sum = classCandidateSum.year2Committee.get(id) ?? 0;
    const pubVotes = publicVotesByCandidate.get(id) ?? 0;

    const tcShare =
      classGrandTotal.topCommittee > 0
        ? tcSum / classGrandTotal.topCommittee
        : 0;
    const heShare =
      classGrandTotal.headExecutive > 0
        ? heSum / classGrandTotal.headExecutive
        : 0;
    const y2Share =
      classGrandTotal.year2Committee > 0
        ? y2Sum / classGrandTotal.year2Committee
        : 0;
    const publicShare = publicTotal > 0 ? pubVotes / publicTotal : 0;

    const internalAggregate = wTc * tcShare + wHe * heShare + wY2 * y2Share;
    const publicAggregate = wPub * publicShare;
    const finalScore = internalAggregate + publicAggregate;

    return {
      candidateId: id as Id<"candidates">,
      tcShare,
      heShare,
      y2Share,
      publicVotes: pubVotes,
      publicShare,
      internalAggregate,
      publicAggregate,
      finalScore,
    };
  });

  if (breakdown.length === 0) {
    return {
      breakdown,
      winnerCandidateId: null,
      tieGroup: [],
      tieBreakStep: "finalScore",
      weights,
    };
  }

  let candidates = breakdown.slice();
  let usedStep: TieBreakStep = "finalScore";

  const ladder: Array<{
    step: TieBreakStep;
    extract: (b: CandidateBreakdown) => number;
  }> = [
    { step: "finalScore", extract: (b) => b.finalScore },
    { step: "tcShare", extract: (b) => shareForCandidate("topCommittee", b) },
    { step: "heShare", extract: (b) => shareForCandidate("headExecutive", b) },
    { step: "y2Share", extract: (b) => shareForCandidate("year2Committee", b) },
    { step: "publicShare", extract: (b) => b.publicShare },
  ];

  for (const { step, extract } of ladder) {
    const sorted = candidates.slice().sort((a, b) => extract(b) - extract(a));
    const top = sorted[0];
    if (!top) break;
    const topValue = extract(top);
    const tied = sorted.filter((b) => Math.abs(extract(b) - topValue) < EPS);
    usedStep = step;
    if (tied.length === 1) {
      return {
        breakdown,
        winnerCandidateId: tied[0]!.candidateId,
        tieGroup: [],
        tieBreakStep: step,
        weights,
      };
    }
    candidates = tied;
  }

  return {
    breakdown,
    winnerCandidateId: null,
    tieGroup: candidates.map((c) => c.candidateId),
    tieBreakStep: usedStep,
    weights,
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

export function breakdownToStored(
  breakdown: CandidateBreakdown[],
): Doc<"results">["breakdown"] {
  return breakdown.map((b) => ({
    candidateId: b.candidateId,
    tcShare: b.tcShare,
    heShare: b.heShare,
    y2Share: b.y2Share,
    publicVotes: b.publicVotes,
    publicShare: b.publicShare,
    finalScore: b.finalScore,
  }));
}
