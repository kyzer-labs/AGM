import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow, requireSetupPhase } from "./lib/setup";

export const list = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await getElectionOrThrow(ctx, args.electionId);
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    return positions.sort(
      (a, b) => a.tier - b.tier || a.order - b.order || a.name.localeCompare(b.name),
    );
  },
});

/**
 * Per-position impact counts for destructive confirm copy. Returns the
 * number of candidates currently listing this position in their
 * assignments and the number of public votes already cast against this
 * position. Lets the admin see "deleting Director of Technical: this
 * unassigns 4 candidates and discards 0 votes" instead of a generic
 * "this also unassigns it from every candidate" warning.
 */
export const positionImpact = query({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const p = await ctx.db.get(args.positionId);
    if (!p) return null;

    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();

    const votes = await ctx.db
      .query("publicVotes")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();

    return {
      positionId: p._id,
      name: p.name,
      tier: p.tier,
      order: p.order,
      sessionStatus: p.sessionStatus,
      candidateCount: links.length,
      voteCount: votes.length,
    };
  },
});

export const add = mutation({
  args: {
    electionId: v.id("elections"),
    name: v.string(),
    tier: v.number(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Position name must be between 2 and 80 characters.");
    }
    if (!Number.isInteger(args.tier) || args.tier < 1 || args.tier > 9) {
      throw new ConvexError("Tier must be an integer between 1 and 9.");
    }

    const existing = await ctx.db
      .query("positions")
      .withIndex("by_election_tier_order", (q) =>
        q.eq("electionId", args.electionId).eq("tier", args.tier),
      )
      .collect();
    const nextOrder =
      existing.reduce((max, p) => (p.order > max ? p.order : max), -1) + 1;

    const positionId = await ctx.db.insert("positions", {
      electionId: args.electionId,
      name,
      tier: args.tier,
      order: nextOrder,
      sessionStatus: "pending",
    });

    await audit(ctx, {
      actor: voter,
      action: "position.added",
      entityType: "positions",
      entityId: positionId,
      payload: { name, tier: args.tier },
    });

    return positionId;
  },
});

export const updateName = mutation({
  args: {
    positionId: v.id("positions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const p = await ctx.db.get(args.positionId);
    if (!p) throw new ConvexError("Position not found.");
    await requireSetupPhase(ctx, p.electionId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Position name must be between 2 and 80 characters.");
    }
    await ctx.db.patch(p._id, { name });
    await audit(ctx, {
      actor: voter,
      action: "position.renamed",
      entityType: "positions",
      entityId: p._id,
      payload: { name },
    });
  },
});

export const remove = mutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const p = await ctx.db.get(args.positionId);
    if (!p) throw new ConvexError("Position not found.");
    await requireSetupPhase(ctx, p.electionId);

    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position", (q) => q.eq("positionId", p._id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    await ctx.db.delete(p._id);
    await audit(ctx, {
      actor: voter,
      action: "position.removed",
      entityType: "positions",
      entityId: p._id,
      payload: { name: p.name, tier: p.tier },
    });
  },
});

export const move = mutation({
  args: {
    positionId: v.id("positions"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const p = await ctx.db.get(args.positionId);
    if (!p) throw new ConvexError("Position not found.");
    await requireSetupPhase(ctx, p.electionId);

    const sameTier = await ctx.db
      .query("positions")
      .withIndex("by_election_tier_order", (q) =>
        q.eq("electionId", p.electionId).eq("tier", p.tier),
      )
      .collect();
    const sorted = sameTier.sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x._id === p._id);
    if (idx === -1) return;
    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    if (!other) return;

    await ctx.db.patch(p._id, { order: other.order });
    await ctx.db.patch(other._id, { order: p.order });

    await audit(ctx, {
      actor: voter,
      action: "position.reordered",
      entityType: "positions",
      entityId: p._id,
      payload: { direction: args.direction },
    });
  },
});
