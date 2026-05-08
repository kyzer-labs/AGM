import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  canTransition,
  computeSetupReadiness,
  getElectionOrThrow,
  PHASE_LABEL,
} from "./lib/setup";

const PHASE_VALIDATOR = v.union(
  v.literal("setup"),
  v.literal("internalOpen"),
  v.literal("internalClosed"),
  v.literal("publicVoting"),
  v.literal("resultsPreview"),
  v.literal("published"),
);

export const create = mutation({
  args: {
    name: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Election name must be between 2 and 80 characters.");
    }
    if (!Number.isInteger(args.year) || args.year < 2024 || args.year > 2100) {
      throw new ConvexError("Year must be a four-digit integer.");
    }

    const electionId = await ctx.db.insert("elections", {
      name,
      year: args.year,
      phase: "setup",
      createdByVoterId: voter._id,
      createdAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "election.created",
      entityType: "elections",
      entityId: electionId,
      payload: { name, year: args.year },
    });

    return electionId;
  },
});

export const rename = mutation({
  args: {
    electionId: v.id("elections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Election name must be between 2 and 80 characters.");
    }

    await ctx.db.patch(e._id, { name, updatedAt: Date.now() });
    await audit(ctx, {
      actor: voter,
      action: "election.renamed",
      entityType: "elections",
      entityId: e._id,
      payload: { name },
    });
  },
});

export const remove = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);
    if (e.phase !== "setup") {
      throw new ConvexError(
        "Elections can only be deleted while in Setup phase.",
      );
    }

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", e._id))
      .collect();
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", e._id))
      .collect();
    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", e._id))
      .collect();

    for (const c of candidates) {
      const links = await ctx.db
        .query("candidatePositions")
        .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
        .collect();
      for (const l of links) await ctx.db.delete(l._id);
      if (c.photoStorageId) {
        await ctx.storage.delete(c.photoStorageId);
      }
      await ctx.db.delete(c._id);
    }
    for (const p of positions) await ctx.db.delete(p._id);
    for (const w of whitelist) await ctx.db.delete(w._id);

    await ctx.db.delete(e._id);
    await audit(ctx, {
      actor: voter,
      action: "election.deleted",
      entityType: "elections",
      entityId: e._id,
      payload: { name: e.name, year: e.year },
    });
  },
});

export const transitionPhase = mutation({
  args: {
    electionId: v.id("elections"),
    toPhase: PHASE_VALIDATOR,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);

    if (e.phase === args.toPhase) return;

    if (!canTransition(e.phase, args.toPhase)) {
      throw new ConvexError(
        `Cannot move from ${PHASE_LABEL[e.phase]} to ${PHASE_LABEL[args.toPhase]}.`,
      );
    }

    if (args.toPhase === "internalOpen") {
      const readiness = await computeSetupReadiness(ctx, e._id);
      if (!readiness.ready) {
        throw new ConvexError(
          `Setup is not complete: ${readiness.warnings.join(" ")}`,
        );
      }
    }

    if (args.toPhase === "resultsPreview") {
      const positions = await ctx.db
        .query("positions")
        .withIndex("by_election", (q) => q.eq("electionId", e._id))
        .collect();
      const open = positions.filter((p) => p.sessionStatus !== "closed");
      if (open.length > 0) {
        throw new ConvexError(
          `Close every ballot before moving to results preview. ${open.length} position(s) are still open or pending.`,
        );
      }
      const results = await ctx.db
        .query("results")
        .withIndex("by_election", (q) => q.eq("electionId", e._id))
        .collect();
      const unresolved = results.filter((r) => r.winnerCandidateId === undefined);
      if (unresolved.length > 0) {
        throw new ConvexError(
          `Resolve all ties before moving to results preview. ${unresolved.length} unresolved.`,
        );
      }
    }

    if (args.toPhase === "published") {
      const results = await ctx.db
        .query("results")
        .withIndex("by_election", (q) => q.eq("electionId", e._id))
        .collect();
      if (results.length === 0) {
        throw new ConvexError("No results to publish.");
      }
      const unresolved = results.filter((r) => r.winnerCandidateId === undefined);
      if (unresolved.length > 0) {
        throw new ConvexError(
          `${unresolved.length} unresolved tie(s) — resolve before publishing.`,
        );
      }
      const now = Date.now();
      for (const r of results) {
        if (r.state !== "published") {
          await ctx.db.patch(r._id, { state: "published", publishedAt: now });
        }
      }
    }

    await ctx.db.patch(e._id, {
      phase: args.toPhase,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "election.phaseChanged",
      entityType: "elections",
      entityId: e._id,
      payload: {
        from: e.phase,
        to: args.toPhase,
      },
      reason: args.reason,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("elections").collect();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getById = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const e = await ctx.db.get(args.electionId);
    if (!e) return null;
    return e;
  },
});

/**
 * Single source of truth for "what election should the current user
 * see right now?". Admins see the most recent of any phase. Non-admins
 * only see post-setup elections (internalOpen / internalClosed /
 * publicVoting / resultsPreview / published).
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("elections").collect();
    if (all.length === 0) return null;

    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);

    const identity = await ctx.auth.getUserIdentity();
    let isAdmin = false;
    if (identity) {
      const voter = await ctx.db
        .query("voters")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier),
        )
        .unique();
      if (voter) {
        const adminRow = await ctx.db
          .query("admins")
          .withIndex("by_voter", (q) => q.eq("voterId", voter._id))
          .unique();
        isAdmin = adminRow !== null;
      }
    }

    if (isAdmin) {
      const first = sorted[0];
      return first ?? null;
    }
    const visible = sorted.find((e) => e.phase !== "setup");
    return visible ?? null;
  },
});

export const setupReadiness = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await computeSetupReadiness(ctx, args.electionId);
  },
});
