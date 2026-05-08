import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { requireSetupPhase } from "./lib/setup";
import { DEFAULT_RUBRIC_CRITERIA } from "./lib/cycle";

export const list = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) => q.eq("electionId", args.electionId))
      .collect();
    return all.sort((a, b) => a.order - b.order);
  },
});

export const listForVoter = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) => q.eq("electionId", args.electionId))
      .collect();
    return all.sort((a, b) => a.order - b.order);
  },
});

export const add = mutation({
  args: {
    electionId: v.id("elections"),
    name: v.string(),
    maxScore: v.number(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Criterion name must be between 2 and 80 characters.");
    }
    if (
      !Number.isFinite(args.maxScore) ||
      !Number.isInteger(args.maxScore) ||
      args.maxScore < 1 ||
      args.maxScore > 20
    ) {
      throw new ConvexError("Max score must be an integer between 1 and 20.");
    }

    const existing = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError("A criterion with that name already exists.");
    }

    const order = existing.length;
    const id = await ctx.db.insert("rubricCriteria", {
      electionId: args.electionId,
      name,
      maxScore: args.maxScore,
      order,
    });

    await audit(ctx, {
      actor: voter,
      action: "rubric.criteriaAdded",
      entityType: "rubricCriteria",
      entityId: id,
      payload: { name, maxScore: args.maxScore, order },
    });

    return id;
  },
});

export const rename = mutation({
  args: {
    criterionId: v.id("rubricCriteria"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.criterionId);
    if (!c) throw new ConvexError("Criterion not found.");
    await requireSetupPhase(ctx, c.electionId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("Criterion name must be between 2 and 80 characters.");
    }

    const others = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election", (q) => q.eq("electionId", c.electionId))
      .collect();
    if (
      others.some(
        (o) => o._id !== c._id && o.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new ConvexError("Another criterion already has that name.");
    }

    await ctx.db.patch(c._id, { name });
    await audit(ctx, {
      actor: voter,
      action: "rubric.criteriaRenamed",
      entityType: "rubricCriteria",
      entityId: c._id,
      payload: { from: c.name, to: name },
    });
  },
});

export const setMaxScore = mutation({
  args: {
    criterionId: v.id("rubricCriteria"),
    maxScore: v.number(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.criterionId);
    if (!c) throw new ConvexError("Criterion not found.");
    await requireSetupPhase(ctx, c.electionId);

    if (
      !Number.isFinite(args.maxScore) ||
      !Number.isInteger(args.maxScore) ||
      args.maxScore < 1 ||
      args.maxScore > 20
    ) {
      throw new ConvexError("Max score must be an integer between 1 and 20.");
    }

    await ctx.db.patch(c._id, { maxScore: args.maxScore });
    await audit(ctx, {
      actor: voter,
      action: "rubric.criteriaMaxScoreSet",
      entityType: "rubricCriteria",
      entityId: c._id,
      payload: { from: c.maxScore, to: args.maxScore },
    });
  },
});

export const remove = mutation({
  args: { criterionId: v.id("rubricCriteria") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.criterionId);
    if (!c) throw new ConvexError("Criterion not found.");
    await requireSetupPhase(ctx, c.electionId);

    const dependentScores = await ctx.db
      .query("internalScores")
      .filter((q) => q.eq(q.field("criterionId"), c._id))
      .collect();
    for (const s of dependentScores) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(c._id);

    const remaining = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) => q.eq("electionId", c.electionId))
      .collect();
    const sorted = remaining.sort((a, b) => a.order - b.order);
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      if (!r) continue;
      if (r.order !== i) await ctx.db.patch(r._id, { order: i });
    }

    await audit(ctx, {
      actor: voter,
      action: "rubric.criteriaRemoved",
      entityType: "rubricCriteria",
      entityId: c._id,
      payload: {
        name: c.name,
        deletedDraftScores: dependentScores.length,
      },
    });
  },
});

export const move = mutation({
  args: {
    criterionId: v.id("rubricCriteria"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.criterionId);
    if (!c) throw new ConvexError("Criterion not found.");
    await requireSetupPhase(ctx, c.electionId);

    const all = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) => q.eq("electionId", c.electionId))
      .collect();
    const sorted = all.sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x._id === c._id);
    if (idx === -1) return;
    const target = args.direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sorted.length) return;
    const other = sorted[target];
    if (!other) return;
    await ctx.db.patch(c._id, { order: other.order });
    await ctx.db.patch(other._id, { order: c.order });

    await audit(ctx, {
      actor: voter,
      action: "rubric.criteriaReordered",
      entityType: "rubricCriteria",
      entityId: c._id,
      payload: { direction: args.direction, from: c.order, to: other.order },
    });
  },
});

export const seedDefaults = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);

    const existing = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    if (existing.length > 0) {
      throw new ConvexError("This election already has rubric criteria configured.");
    }

    const inserted: string[] = [];
    for (let i = 0; i < DEFAULT_RUBRIC_CRITERIA.length; i++) {
      const c = DEFAULT_RUBRIC_CRITERIA[i];
      if (!c) continue;
      const id = await ctx.db.insert("rubricCriteria", {
        electionId: args.electionId,
        name: c.name,
        maxScore: c.maxScore,
        order: i,
      });
      inserted.push(id);
    }

    await audit(ctx, {
      actor: voter,
      action: "rubric.seeded",
      entityType: "elections",
      entityId: args.electionId,
      payload: { count: inserted.length },
    });

    return inserted.length;
  },
});
