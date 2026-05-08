import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSuperAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import type { Doc, Id } from "./_generated/dataModel";

const RUBRIC_KEYS = [
  "leadership",
  "teamwork",
  "professionalism",
  "commitment",
  "personality",
] as const;

export const internalScores = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const candidatesById = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect()) {
      candidatesById.set(c._id, c);
    }

    const rows: {
      evaluatorEmail: string;
      evaluatorName: string;
      status: "draft" | "submitted";
      submittedAt: string;
      candidateName: string;
      candidateMatric: string;
      leadership: number;
      teamwork: number;
      professionalism: number;
      commitment: number;
      personality: number;
      average: number;
    }[] = [];

    for (const ev of evaluations) {
      const voter = await ctx.db.get(ev.evaluatorVoterId);
      const scores = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", ev._id))
        .collect();
      for (const s of scores) {
        const c = candidatesById.get(s.candidateId);
        if (!c) continue;
        const sum = RUBRIC_KEYS.reduce((acc, k) => acc + s[k], 0);
        rows.push({
          evaluatorEmail: voter?.email ?? "—",
          evaluatorName: voter?.fullName ?? "—",
          status: ev.status,
          submittedAt: ev.submittedAt
            ? new Date(ev.submittedAt).toISOString()
            : "",
          candidateName: c.fullName,
          candidateMatric: c.matric,
          leadership: s.leadership,
          teamwork: s.teamwork,
          professionalism: s.professionalism,
          commitment: s.commitment,
          personality: s.personality,
          average: sum / RUBRIC_KEYS.length,
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.evaluatorEmail.localeCompare(b.evaluatorEmail) ||
        a.candidateName.localeCompare(b.candidateName),
    );
    return rows;
  },
});

export const publicCounts = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    positions.sort((a, b) => a.tier - b.tier || a.order - b.order);

    const candidatesById = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect()) {
      candidatesById.set(c._id, c);
    }

    const rows: {
      positionName: string;
      tier: number;
      order: number;
      candidateName: string;
      candidateMatric: string;
      votes: number;
    }[] = [];

    for (const p of positions) {
      const links = await ctx.db
        .query("candidatePositions")
        .withIndex("by_position", (q) => q.eq("positionId", p._id))
        .collect();
      const votes = await ctx.db
        .query("publicVotes")
        .withIndex("by_position", (q) => q.eq("positionId", p._id))
        .collect();
      const counts = new Map<string, number>();
      for (const v of votes)
        counts.set(v.candidateId, (counts.get(v.candidateId) ?? 0) + 1);
      for (const l of links) {
        const c = candidatesById.get(l.candidateId);
        if (!c) continue;
        rows.push({
          positionName: p.name,
          tier: p.tier,
          order: p.order,
          candidateName: c.fullName,
          candidateMatric: c.matric,
          votes: counts.get(l.candidateId) ?? 0,
        });
      }
    }

    return rows;
  },
});

export const combined = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    positions.sort((a, b) => a.tier - b.tier || a.order - b.order);

    const results = await ctx.db
      .query("results")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const resultByPosition = new Map<Id<"positions">, Doc<"results">>();
    for (const r of results) resultByPosition.set(r.positionId, r);

    const candidatesById = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect()) {
      candidatesById.set(c._id, c);
    }

    const rows: {
      positionName: string;
      tier: number;
      order: number;
      state: string;
      candidateName: string;
      candidateMatric: string;
      isWinner: boolean;
      internalAvg: number;
      internalShare: number;
      publicVotes: number;
      publicShare: number;
      finalScore: number;
    }[] = [];

    for (const p of positions) {
      const r = resultByPosition.get(p._id);
      if (!r) continue;
      for (const b of r.breakdown) {
        const c = candidatesById.get(b.candidateId);
        rows.push({
          positionName: p.name,
          tier: p.tier,
          order: p.order,
          state: r.state,
          candidateName: c?.fullName ?? "Unknown",
          candidateMatric: c?.matric ?? "—",
          isWinner: r.winnerCandidateId === b.candidateId,
          internalAvg: b.internalAvg,
          internalShare: b.internalShare,
          publicVotes: b.publicVotes,
          publicShare: b.publicShare,
          finalScore: b.finalScore,
        });
      }
    }

    return rows;
  },
});

export const participation = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const whitelistEmails = new Set(whitelist.map((w) => w.email));

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const evalsByVoter = new Map<Id<"voters">, Doc<"internalEvaluations">>();
    for (const e of evaluations) evalsByVoter.set(e.evaluatorVoterId, e);

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    positions.sort((a, b) => a.tier - b.tier || a.order - b.order);

    const votesByVoter = new Map<Id<"voters">, Set<Id<"positions">>>();
    const votesArrays = await Promise.all(
      positions.map((p) =>
        ctx.db
          .query("publicVotes")
          .withIndex("by_position", (q) => q.eq("positionId", p._id))
          .collect(),
      ),
    );
    for (const arr of votesArrays) {
      for (const v of arr) {
        const set = votesByVoter.get(v.voterVoterId) ?? new Set();
        set.add(v.positionId);
        votesByVoter.set(v.voterVoterId, set);
      }
    }

    const voters = await ctx.db.query("voters").collect();
    const adminEmails = new Set<string>();
    for (const a of await ctx.db.query("admins").collect())
      adminEmails.add(a.email);

    return voters.map((v) => ({
      email: v.email,
      fullName: v.fullName ?? "—",
      profileComplete: v.profileComplete,
      isAdmin: adminEmails.has(v.email),
      isInternalEvaluator: whitelistEmails.has(v.email),
      evaluationStatus: evalsByVoter.get(v._id)?.status ?? "notStarted",
      submittedAt: evalsByVoter.get(v._id)?.submittedAt
        ? new Date(
            evalsByVoter.get(v._id)?.submittedAt as number,
          ).toISOString()
        : "",
      positionsVoted: positions
        .filter((p) => votesByVoter.get(v._id)?.has(p._id) ?? false)
        .map((p) => p.name)
        .join("; "),
    }));
  },
});

export const auditLog = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(args.limit ?? 1000, 5000);
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_created")
      .order("desc")
      .collect();

    const filtered = rows.filter((r) => {
      if (args.fromMs && r.createdAt < args.fromMs) return false;
      if (args.toMs && r.createdAt > args.toMs) return false;
      return true;
    });

    const limited = filtered.slice(0, limit);

    return limited.map((r) => ({
      createdAt: new Date(r.createdAt).toISOString(),
      actorEmail: r.actorEmail ?? "",
      action: r.action,
      entityType: r.entityType ?? "",
      entityId: r.entityId ?? "",
      reason: r.reason ?? "",
      payload: r.payload ? JSON.stringify(r.payload) : "",
    }));
  },
});

/**
 * Emergency audit: per-voter privacy-sensitive lookup.
 *
 * Restricted to super admins, requires a written reason. The act of
 * requesting this view is itself audited so future investigators can
 * see every emergency lookup in the chain of trust.
 */
export const emergencyVoterAudit = mutation({
  args: {
    targetEmail: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter: actor } = await requireSuperAdmin(ctx);
    const targetEmail = args.targetEmail.trim().toLowerCase();
    const reason = args.reason.trim();
    if (reason.length < 10) {
      throw new Error(
        "Provide a substantive reason (>= 10 chars) — this lookup is logged.",
      );
    }

    const target = await ctx.db
      .query("voters")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .unique();
    if (!target) {
      throw new Error("No voter found with that email.");
    }

    const auditEntries = (
      await ctx.db.query("auditLog").withIndex("by_created").collect()
    ).filter(
      (a) =>
        a.actorVoterId === target._id ||
        (a.actorEmail !== undefined && a.actorEmail === targetEmail),
    );

    const allVotes = (await ctx.db.query("publicVotes").collect()).filter(
      (v) => v.voterVoterId === target._id,
    );

    const allEvaluations = (
      await ctx.db.query("internalEvaluations").collect()
    ).filter((e) => e.evaluatorVoterId === target._id);

    await audit(ctx, {
      actor,
      action: "audit.emergencyVoterLookup",
      entityType: "voters",
      entityId: target._id,
      payload: {
        targetEmail,
        auditCount: auditEntries.length,
        voteCount: allVotes.length,
        evaluationCount: allEvaluations.length,
      },
      reason,
    });

    return {
      target: {
        email: target.email,
        fullName: target.fullName ?? "—",
        matric: target.matric ?? "—",
        profileComplete: target.profileComplete,
        createdAt: new Date(target.createdAt).toISOString(),
      },
      auditEntries: auditEntries.slice(0, 1000).map((a) => ({
        createdAt: new Date(a.createdAt).toISOString(),
        action: a.action,
        entityType: a.entityType ?? "",
        entityId: a.entityId ?? "",
        reason: a.reason ?? "",
        payload: a.payload ? JSON.stringify(a.payload) : "",
      })),
      voteCount: allVotes.length,
      evaluationCount: allEvaluations.length,
    };
  },
});
