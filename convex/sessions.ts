import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import {
  computeResultForPosition,
  getResolvedWinnerCandidateIds,
  getUnresolvedTiePositionIds,
} from "./lib/results";
import type { Doc, Id } from "./_generated/dataModel";

async function getPositionsOrdered(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  electionId: Id<"elections">,
): Promise<Doc<"positions">[]> {
  const positions = await ctx.db
    .query("positions")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  return positions.sort(
    (a, b) =>
      a.tier - b.tier || a.order - b.order || a.name.localeCompare(b.name),
  );
}

export const listSessionStatuses = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const positions = await getPositionsOrdered(ctx, args.electionId);

    const results = await ctx.db
      .query("results")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const resultByPositionId = new Map<Id<"positions">, Doc<"results">>();
    for (const r of results) resultByPositionId.set(r.positionId, r);

    const enriched = await Promise.all(
      positions.map(async (p) => {
        const result = resultByPositionId.get(p._id) ?? null;
        const voteCount =
          p.sessionStatus === "active" || p.sessionStatus === "closed"
            ? (
                await ctx.db
                  .query("publicVotes")
                  .withIndex("by_position", (q) => q.eq("positionId", p._id))
                  .collect()
              ).length
            : 0;
        return {
          positionId: p._id,
          name: p.name,
          tier: p.tier,
          order: p.order,
          sessionStatus: p.sessionStatus,
          sessionStartedAt: p.sessionStartedAt ?? null,
          sessionClosedAt: p.sessionClosedAt ?? null,
          voteCount,
          resultState: result?.state ?? null,
          winnerCandidateId: result?.winnerCandidateId ?? null,
          hasUnresolvedTie:
            result !== null && result.winnerCandidateId === undefined,
        };
      }),
    );

    return enriched;
  },
});

export const getActiveSession = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const election = await ctx.db.get(args.electionId);
    if (!election) return null;
    if (election.phase !== "publicVoting") return null;

    const active = await ctx.db
      .query("positions")
      .withIndex("by_election_session", (q) =>
        q.eq("electionId", args.electionId).eq("sessionStatus", "active"),
      )
      .first();
    if (!active) return null;

    const winners = await getResolvedWinnerCandidateIds(
      ctx,
      args.electionId,
    );

    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", active._id))
      .collect();

    const candidates = await Promise.all(
      links
        .filter((l) => !winners.has(l.candidateId))
        .map(async (l) => {
          const c = await ctx.db.get(l.candidateId);
          if (!c) return null;
          return {
            candidateId: c._id,
            fullName: c.fullName,
            matric: c.matric,
            bio: c.bio ?? null,
            photoUrl: c.photoStorageId
              ? await ctx.storage.getUrl(c.photoStorageId)
              : null,
            fallbackOrder: l.fallbackOrder,
          };
        }),
    );

    return {
      positionId: active._id,
      name: active.name,
      tier: active.tier,
      sessionStartedAt: active.sessionStartedAt ?? null,
      candidates: candidates
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => a.fallbackOrder - b.fallbackOrder),
    };
  },
});

export const previewCascade = query({
  args: {
    electionId: v.id("elections"),
    positionId: v.id("positions"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position || position.electionId !== args.electionId) {
      throw new ConvexError("Position not found in this election.");
    }

    const winners = await getResolvedWinnerCandidateIds(
      ctx,
      args.electionId,
    );
    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", position._id))
      .collect();

    const eligible: {
      candidateId: Id<"candidates">;
      fullName: string;
      matric: string;
    }[] = [];
    const removed: { candidateId: Id<"candidates">; fullName: string }[] = [];

    for (const l of links) {
      const c = await ctx.db.get(l.candidateId);
      if (!c) continue;
      if (winners.has(l.candidateId)) {
        removed.push({ candidateId: c._id, fullName: c.fullName });
      } else {
        eligible.push({
          candidateId: c._id,
          fullName: c.fullName,
          matric: c.matric,
        });
      }
    }

    return { eligible, removed };
  },
});

export const startSession = mutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position) throw new ConvexError("Position not found.");

    const election = await getElectionOrThrow(ctx, position.electionId);
    if (election.phase !== "publicVoting") {
      throw new ConvexError(
        "Public voting is not active. Move the cycle to publicVoting first.",
      );
    }
    if (position.sessionStatus !== "pending") {
      throw new ConvexError("This position has already been opened or closed.");
    }

    const otherActive = await ctx.db
      .query("positions")
      .withIndex("by_election_session", (q) =>
        q.eq("electionId", election._id).eq("sessionStatus", "active"),
      )
      .first();
    if (otherActive) {
      throw new ConvexError(
        `Close "${otherActive.name}" before opening another ballot.`,
      );
    }

    const unresolved = await getUnresolvedTiePositionIds(ctx, election._id);
    if (unresolved.length > 0) {
      throw new ConvexError(
        "Resolve the previous position's tie before opening another ballot.",
      );
    }

    const winners = await getResolvedWinnerCandidateIds(ctx, election._id);
    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", position._id))
      .collect();
    const eligible = links.filter((l) => !winners.has(l.candidateId));
    if (eligible.length === 0) {
      throw new ConvexError(
        "No eligible candidates remain for this position after the cascade.",
      );
    }

    await ctx.db.patch(position._id, {
      sessionStatus: "active",
      sessionStartedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "session.started",
      entityType: "positions",
      entityId: position._id,
      payload: { name: position.name, eligibleCount: eligible.length },
    });
  },
});

export const closeSession = mutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position) throw new ConvexError("Position not found.");
    if (position.sessionStatus !== "active") {
      throw new ConvexError("This position is not currently active.");
    }
    const election = await getElectionOrThrow(ctx, position.electionId);

    const winners = await getResolvedWinnerCandidateIds(ctx, election._id);
    const computed = await computeResultForPosition(
      ctx,
      election._id,
      position._id,
      winners,
    );

    const now = Date.now();
    await ctx.db.patch(position._id, {
      sessionStatus: "closed",
      sessionClosedAt: now,
    });

    const existingResult = await ctx.db
      .query("results")
      .withIndex("by_election_position", (q) =>
        q.eq("electionId", election._id).eq("positionId", position._id),
      )
      .unique();

    const resultPayload = {
      electionId: election._id,
      positionId: position._id,
      state:
        computed.winnerCandidateId === null
          ? ("manualTieResolved" as const)
          : ("previewed" as const),
      winnerCandidateId: computed.winnerCandidateId ?? undefined,
      breakdown: computed.breakdown,
      updatedAt: now,
    };

    if (existingResult) {
      await ctx.db.patch(existingResult._id, resultPayload);
    } else {
      await ctx.db.insert("results", resultPayload);
    }

    await audit(ctx, {
      actor: voter,
      action: "session.closed",
      entityType: "positions",
      entityId: position._id,
      payload: {
        name: position.name,
        winner: computed.winnerCandidateId ?? null,
        tied: computed.tieGroup.length > 0 ? computed.tieGroup.length : 0,
      },
    });

    return {
      winnerCandidateId: computed.winnerCandidateId,
      tieGroup: computed.tieGroup,
    };
  },
});

export const resolveTie = mutation({
  args: {
    positionId: v.id("positions"),
    winnerCandidateId: v.id("candidates"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position) throw new ConvexError("Position not found.");

    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new ConvexError("Provide a tie-resolution reason for the audit log.");
    }

    const result = await ctx.db
      .query("results")
      .withIndex("by_election_position", (q) =>
        q.eq("electionId", position.electionId).eq("positionId", position._id),
      )
      .unique();
    if (!result) throw new ConvexError("No result row to resolve.");

    const inBreakdown = result.breakdown.find(
      (b) => b.candidateId === args.winnerCandidateId,
    );
    if (!inBreakdown) {
      throw new ConvexError("Selected candidate is not part of this position.");
    }

    await ctx.db.patch(result._id, {
      winnerCandidateId: args.winnerCandidateId,
      state: "manualTieResolved",
      manualResolutionReason: reason,
      resolvedByVoterId: voter._id,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "result.tieResolved",
      entityType: "results",
      entityId: result._id,
      payload: { winner: args.winnerCandidateId },
      reason,
    });
  },
});

export const liveCounts = query({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position) return null;

    const votes = await ctx.db
      .query("publicVotes")
      .withIndex("by_position", (q) => q.eq("positionId", position._id))
      .collect();

    const counts = new Map<string, number>();
    for (const v of votes) {
      counts.set(v.candidateId, (counts.get(v.candidateId) ?? 0) + 1);
    }

    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", position._id))
      .collect();

    const enriched = await Promise.all(
      links.map(async (l) => {
        const c = await ctx.db.get(l.candidateId);
        return {
          candidateId: l.candidateId,
          fullName: c?.fullName ?? "Unknown",
          count: counts.get(l.candidateId) ?? 0,
        };
      }),
    );

    return {
      total: votes.length,
      counts: enriched.sort((a, b) => b.count - a.count),
    };
  },
});
