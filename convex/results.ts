import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSuperAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import { getWeights } from "./lib/cycle";
import {
  breakdownToStored,
  computeResultForPosition,
  getResolvedWinnerCandidateIds,
} from "./lib/results";
import type { Doc, Id } from "./_generated/dataModel";

interface BreakdownEnriched {
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

interface ResultRow {
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
  weights: ReturnType<typeof getWeights>;
  breakdown: BreakdownEnriched[];
}

async function buildResultRows(
  ctx: import("./_generated/server").QueryCtx,
  electionId: Id<"elections">,
  publishedOnly: boolean,
): Promise<ResultRow[]> {
  const election = await getElectionOrThrow(ctx, electionId);
  const weights = getWeights(election);

  const positions = await ctx.db
    .query("positions")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();

  const results = await ctx.db
    .query("results")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  const resultByPosition = new Map<Id<"positions">, Doc<"results">>();
  for (const r of results) resultByPosition.set(r.positionId, r);

  const candidatesById = new Map<Id<"candidates">, Doc<"candidates">>();
  for (const c of await ctx.db
    .query("candidates")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect()) {
    candidatesById.set(c._id, c);
  }

  const wTc = weights.topCommittee / 100;
  const wHe = weights.headExecutive / 100;
  const wY2 = weights.year2Committee / 100;
  const wPub = weights.public / 100;

  const rows: ResultRow[] = [];
  for (const p of positions) {
    const r = resultByPosition.get(p._id);
    if (!r) {
      if (publishedOnly) continue;
      rows.push({
        positionId: p._id,
        positionName: p.name,
        tier: p.tier,
        order: p.order,
        state: null,
        winnerCandidateId: null,
        winnerName: null,
        hasUnresolvedTie: false,
        tieBreakStep: null,
        manualResolutionReason: null,
        publishedAt: null,
        totalPublicVotes: 0,
        weights,
        breakdown: [],
      });
      continue;
    }
    if (publishedOnly && r.state !== "published") continue;

    const breakdown: BreakdownEnriched[] = await Promise.all(
      r.breakdown.map(async (b) => {
        const c = candidatesById.get(b.candidateId);
        const photoUrl =
          c?.photoStorageId !== undefined
            ? await ctx.storage.getUrl(c.photoStorageId)
            : null;
        const tcShare = b.tcShare ?? b.internalShare ?? 0;
        const heShare = b.heShare ?? 0;
        const y2Share = b.y2Share ?? 0;
        const internalAggregate = wTc * tcShare + wHe * heShare + wY2 * y2Share;
        const publicAggregate = wPub * b.publicShare;
        return {
          candidateId: b.candidateId,
          fullName: c?.fullName ?? "Unknown",
          matric: c?.matric ?? "—",
          photoUrl,
          tcShare,
          heShare,
          y2Share,
          publicVotes: b.publicVotes,
          publicShare: b.publicShare,
          internalAggregate,
          publicAggregate,
          finalScore: b.finalScore,
        };
      }),
    );
    breakdown.sort((a, b) => b.finalScore - a.finalScore);

    const totalPublicVotes = breakdown.reduce(
      (s, b) => s + b.publicVotes,
      0,
    );

    rows.push({
      positionId: p._id,
      positionName: p.name,
      tier: p.tier,
      order: p.order,
      state: r.state,
      winnerCandidateId: r.winnerCandidateId ?? null,
      winnerName: r.winnerCandidateId
        ? (candidatesById.get(r.winnerCandidateId)?.fullName ?? null)
        : null,
      hasUnresolvedTie: r.winnerCandidateId === undefined,
      tieBreakStep: r.tieBreakStep ?? null,
      manualResolutionReason: r.manualResolutionReason ?? null,
      publishedAt: r.publishedAt ?? null,
      totalPublicVotes,
      weights,
      breakdown,
    });
  }

  rows.sort((a, b) => a.tier - b.tier || a.order - b.order);
  return rows;
}

export const adminPreview = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await buildResultRows(ctx, args.electionId, false);
  },
});

export const publicPublished = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const election = await ctx.db.get(args.electionId);
    if (!election) return null;
    if (election.phase !== "published") {
      return { phase: election.phase, rows: [], weights: getWeights(election) };
    }
    const rows = await buildResultRows(ctx, args.electionId, true);
    return {
      phase: election.phase,
      rows,
      weights: getWeights(election),
    };
  },
});

export const recompute = mutation({
  args: {
    positionId: v.id("positions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireSuperAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new Error("Provide a recompute reason for the audit log.");
    }

    const position = await ctx.db.get(args.positionId);
    if (!position) throw new Error("Position not found.");
    const election = await getElectionOrThrow(ctx, position.electionId);
    if (
      election.phase !== "publicVoting" &&
      election.phase !== "resultsPreview"
    ) {
      throw new Error(
        "Recompute is only available during publicVoting or resultsPreview.",
      );
    }

    const existing = await ctx.db
      .query("results")
      .withIndex("by_election_position", (q) =>
        q.eq("electionId", election._id).eq("positionId", position._id),
      )
      .unique();

    const winners = await getResolvedWinnerCandidateIds(ctx, election._id);
    if (existing?.winnerCandidateId) {
      winners.delete(existing.winnerCandidateId);
    }

    const computed = await computeResultForPosition(
      ctx,
      election._id,
      position._id,
      winners,
    );

    const payload = {
      electionId: election._id,
      positionId: position._id,
      state:
        computed.winnerCandidateId === null
          ? ("manualTieResolved" as const)
          : ("previewed" as const),
      winnerCandidateId: computed.winnerCandidateId ?? undefined,
      breakdown: breakdownToStored(computed.breakdown),
      tieBreakStep: computed.tieBreakStep,
      manualResolutionReason: undefined,
      resolvedByVoterId: undefined,
      publishedAt: undefined,
      updatedAt: Date.now(),
    };

    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("results", payload);

    await audit(ctx, {
      actor: voter,
      action: "result.recomputed",
      entityType: "results",
      entityId: existing?._id ?? "(new)",
      payload: {
        positionId: position._id,
        winner: computed.winnerCandidateId ?? null,
        tieBreakStep: computed.tieBreakStep,
      },
      reason,
    });
  },
});
