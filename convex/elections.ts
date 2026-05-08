import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  canTransition,
  computeSetupReadiness,
  getElectionOrThrow,
  PHASE_LABEL,
  requireSetupPhase,
} from "./lib/setup";
import {
  DEFAULT_RUBRIC_CRITERIA,
  DEFAULT_WEIGHTS,
  validateWeights,
} from "./lib/cycle";

const PHASE_VALIDATOR = v.union(
  v.literal("setup"),
  v.literal("internalOpen"),
  v.literal("internalClosed"),
  v.literal("publicVoting"),
  v.literal("resultsPreview"),
  v.literal("published"),
);

async function cancelScheduledJobs(
  ctx: MutationCtx,
  election: Doc<"elections">,
): Promise<{ cancelledOpen: boolean; cancelledClose: boolean }> {
  let cancelledOpen = false;
  let cancelledClose = false;
  if (election.scheduledOpenJobId) {
    try {
      await ctx.scheduler.cancel(election.scheduledOpenJobId);
      cancelledOpen = true;
    } catch {
      // job already completed or not found
    }
  }
  if (election.scheduledCloseJobId) {
    try {
      await ctx.scheduler.cancel(election.scheduledCloseJobId);
      cancelledClose = true;
    } catch {
      // job already completed or not found
    }
  }
  return { cancelledOpen, cancelledClose };
}

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
      weightTopCommittee: DEFAULT_WEIGHTS.topCommittee,
      weightHeadExecutive: DEFAULT_WEIGHTS.headExecutive,
      weightYear2Committee: DEFAULT_WEIGHTS.year2Committee,
      weightPublic: DEFAULT_WEIGHTS.public,
    });

    for (let i = 0; i < DEFAULT_RUBRIC_CRITERIA.length; i++) {
      const c = DEFAULT_RUBRIC_CRITERIA[i];
      if (!c) continue;
      await ctx.db.insert("rubricCriteria", {
        electionId,
        name: c.name,
        maxScore: c.maxScore,
        order: i,
      });
    }

    await audit(ctx, {
      actor: voter,
      action: "election.created",
      entityType: "elections",
      entityId: electionId,
      payload: {
        name,
        year: args.year,
        seededRubricCriteria: DEFAULT_RUBRIC_CRITERIA.length,
      },
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

export const setWeights = mutation({
  args: {
    electionId: v.id("elections"),
    weightTopCommittee: v.number(),
    weightHeadExecutive: v.number(),
    weightYear2Committee: v.number(),
    weightPublic: v.number(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await requireSetupPhase(ctx, args.electionId);

    const weights = {
      topCommittee: args.weightTopCommittee,
      headExecutive: args.weightHeadExecutive,
      year2Committee: args.weightYear2Committee,
      public: args.weightPublic,
    };
    validateWeights(weights);

    await ctx.db.patch(e._id, {
      weightTopCommittee: weights.topCommittee,
      weightHeadExecutive: weights.headExecutive,
      weightYear2Committee: weights.year2Committee,
      weightPublic: weights.public,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "election.weightsSet",
      entityType: "elections",
      entityId: e._id,
      payload: {
        topCommittee: weights.topCommittee,
        headExecutive: weights.headExecutive,
        year2Committee: weights.year2Committee,
        public: weights.public,
      },
    });
  },
});

export const setScheduledWindow = mutation({
  args: {
    electionId: v.id("elections"),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);

    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new ConvexError(
        `Schedule can only be modified during Setup or Internal evaluation. Current phase: ${PHASE_LABEL[e.phase]}.`,
      );
    }

    if (args.startAt !== undefined && args.endAt !== undefined) {
      if (args.endAt <= args.startAt) {
        throw new ConvexError("End time must be after start time.");
      }
    }

    await cancelScheduledJobs(ctx, e);

    let scheduledOpenJobId: Id<"_scheduled_functions"> | undefined;
    let scheduledCloseJobId: Id<"_scheduled_functions"> | undefined;

    const now = Date.now();
    if (args.startAt !== undefined && args.startAt > now && e.phase === "setup") {
      scheduledOpenJobId = await ctx.scheduler.runAt(
        args.startAt,
        internal.elections.scheduledOpen,
        { electionId: e._id },
      );
    }
    if (args.endAt !== undefined && args.endAt > now) {
      scheduledCloseJobId = await ctx.scheduler.runAt(
        args.endAt,
        internal.elections.scheduledClose,
        { electionId: e._id },
      );
    }

    await ctx.db.patch(e._id, {
      scheduledStartAt: args.startAt,
      scheduledEndAt: args.endAt,
      scheduledOpenJobId,
      scheduledCloseJobId,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "election.scheduledWindowSet",
      entityType: "elections",
      entityId: e._id,
      payload: {
        startAt: args.startAt ?? null,
        endAt: args.endAt ?? null,
      },
    });
  },
});

export const clearScheduledWindow = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);

    await cancelScheduledJobs(ctx, e);

    await ctx.db.patch(e._id, {
      scheduledStartAt: undefined,
      scheduledEndAt: undefined,
      scheduledOpenJobId: undefined,
      scheduledCloseJobId: undefined,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "election.scheduledWindowCleared",
      entityType: "elections",
      entityId: e._id,
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

    await cancelScheduledJobs(ctx, e);

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
    const rubricCriteria = await ctx.db
      .query("rubricCriteria")
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
    for (const r of rubricCriteria) await ctx.db.delete(r._id);

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

    if (e.scheduledOpenJobId || e.scheduledCloseJobId) {
      await cancelScheduledJobs(ctx, e);
      await ctx.db.patch(e._id, {
        scheduledOpenJobId: undefined,
        scheduledCloseJobId: undefined,
      });
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
        manualOverride:
          (e.scheduledOpenJobId || e.scheduledCloseJobId) ? true : false,
      },
      reason: args.reason,
    });
  },
});

export const scheduledOpen = internalMutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.electionId);
    if (!e) return;
    if (e.phase !== "setup") return;

    const readiness = await computeSetupReadiness(ctx, e._id);
    if (!readiness.ready) {
      await audit(ctx, {
        action: "election.scheduledOpenSkipped",
        entityType: "elections",
        entityId: e._id,
        reason: readiness.warnings.join(" "),
      });
      return;
    }

    await ctx.db.patch(e._id, {
      phase: "internalOpen",
      scheduledOpenJobId: undefined,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      action: "election.scheduledOpenTriggered",
      entityType: "elections",
      entityId: e._id,
      payload: { from: "setup", to: "internalOpen" },
    });
  },
});

export const scheduledClose = internalMutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.electionId);
    if (!e) return;
    if (e.phase !== "internalOpen") return;

    await ctx.db.patch(e._id, {
      phase: "internalClosed",
      scheduledCloseJobId: undefined,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      action: "election.scheduledCloseTriggered",
      entityType: "elections",
      entityId: e._id,
      payload: { from: "internalOpen", to: "internalClosed" },
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
