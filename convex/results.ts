import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSuperAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import {
  computeResultForPosition,
  getResolvedWinnerCandidateIds,
} from "./lib/results";
import type { Doc, Id } from "./_generated/dataModel";

interface BreakdownEnriched {
  candidateId: Id<"candidates">;
  fullName: string;
  matric: string;
  photoUrl: string | null;
  internalAvg: number;
  internalShare: number;
  publicVotes: number;
  publicShare: number;
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
  manualResolutionReason: string | null;
  publishedAt: number | null;
  totalPublicVotes: number;
  breakdown: BreakdownEnriched[];
}

async function buildResultRows(
  ctx: import("./_generated/server").QueryCtx,
  electionId: Id<"elections">,
  publishedOnly: boolean,
): Promise<ResultRow[]> {
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
        manualResolutionReason: null,
        publishedAt: null,
        totalPublicVotes: 0,
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
        return {
          candidateId: b.candidateId,
          fullName: c?.fullName ?? "Unknown",
          matric: c?.matric ?? "—",
          photoUrl,
          internalAvg: b.internalAvg,
          internalShare: b.internalShare,
          publicVotes: b.publicVotes,
          publicShare: b.publicShare,
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
      manualResolutionReason: r.manualResolutionReason ?? null,
      publishedAt: r.publishedAt ?? null,
      totalPublicVotes,
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
      return { phase: election.phase, rows: [] };
    }
    const rows = await buildResultRows(ctx, args.electionId, true);
    return { phase: election.phase, rows };
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
      breakdown: computed.breakdown,
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
      },
      reason,
    });
  },
});
