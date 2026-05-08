import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSuperAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  getEntryClass,
  getWeights,
  VOTER_CLASS_LABEL,
  VOTER_CLASSES,
  type VoterClass,
} from "./lib/cycle";
import { getElectionOrThrow } from "./lib/setup";
import type { Doc, Id } from "./_generated/dataModel";

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

    const criteria = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) =>
        q.eq("electionId", args.electionId),
      )
      .collect();
    const criteriaById = new Map(
      criteria.map((c) => [c._id, c] as const),
    );

    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const classByEmail = new Map<string, VoterClass>();
    for (const wl of whitelist) {
      classByEmail.set(wl.email, getEntryClass(wl));
    }

    const rows: {
      evaluatorEmail: string;
      evaluatorName: string;
      voterClass: string;
      status: "draft" | "submitted";
      submittedAt: string;
      candidateName: string;
      candidateMatric: string;
      criterion: string;
      score: number;
      maxScore: number;
    }[] = [];

    for (const ev of evaluations) {
      const voter = await ctx.db.get(ev.evaluatorVoterId);
      const voterClass = voter ? classByEmail.get(voter.email) : undefined;

      const scores = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", ev._id))
        .collect();

      for (const s of scores) {
        if (s.criterionId === undefined || s.score === undefined) continue;
        const c = candidatesById.get(s.candidateId);
        const crit = criteriaById.get(s.criterionId);
        if (!c || !crit) continue;
        rows.push({
          evaluatorEmail: voter?.email ?? "—",
          evaluatorName: voter?.fullName ?? "—",
          voterClass: voterClass ? VOTER_CLASS_LABEL[voterClass] : "Unknown",
          status: ev.status,
          submittedAt: ev.submittedAt
            ? new Date(ev.submittedAt).toISOString()
            : "",
          candidateName: c.fullName,
          candidateMatric: c.matric ?? "—",
          criterion: crit.name,
          score: s.score,
          maxScore: crit.maxScore,
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.evaluatorEmail.localeCompare(b.evaluatorEmail) ||
        a.candidateName.localeCompare(b.candidateName) ||
        a.criterion.localeCompare(b.criterion),
    );
    return rows;
  },
});

export const internalScoresByClass = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const election = await getElectionOrThrow(ctx, args.electionId);
    const weights = getWeights(election);

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const candidatesById = new Map<Id<"candidates">, Doc<"candidates">>();
    for (const c of candidates) candidatesById.set(c._id, c);

    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const classByEmail = new Map<string, VoterClass>();
    for (const wl of whitelist) classByEmail.set(wl.email, getEntryClass(wl));

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const submitted = evaluations.filter((e) => e.status === "submitted");

    const evalClassMap = new Map<Id<"internalEvaluations">, VoterClass>();
    for (const ev of submitted) {
      const voter = await ctx.db.get(ev.evaluatorVoterId);
      if (!voter) continue;
      const cls = classByEmail.get(voter.email);
      if (!cls) continue;
      evalClassMap.set(ev._id, cls);
    }

    const classCandidateSum: Record<VoterClass, Map<Id<"candidates">, number>> = {
      topCommittee: new Map(),
      headExecutive: new Map(),
      year2Committee: new Map(),
    };
    const classCandidateEvalCount: Record<
      VoterClass,
      Map<Id<"candidates">, Set<Id<"internalEvaluations">>>
    > = {
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
      for (const s of scores) {
        if (s.criterionId === undefined || s.score === undefined) continue;
        classCandidateSum[cls].set(
          s.candidateId,
          (classCandidateSum[cls].get(s.candidateId) ?? 0) + s.score,
        );
        classGrandTotal[cls] += s.score;
        const set =
          classCandidateEvalCount[cls].get(s.candidateId) ??
          new Set<Id<"internalEvaluations">>();
        set.add(evalId);
        classCandidateEvalCount[cls].set(s.candidateId, set);
      }
    }

    const rows: {
      voterClass: string;
      voterClassWeight: number;
      candidateName: string;
      candidateMatric: string;
      evaluatorCount: number;
      sumOfRubricTotals: number;
      classGrandTotal: number;
      classShare: number;
      weightedContribution: number;
    }[] = [];

    for (const cls of VOTER_CLASSES) {
      const w =
        cls === "topCommittee"
          ? weights.topCommittee
          : cls === "headExecutive"
            ? weights.headExecutive
            : weights.year2Committee;
      const total = classGrandTotal[cls];
      for (const c of candidates) {
        const sum = classCandidateSum[cls].get(c._id) ?? 0;
        const evalCount =
          classCandidateEvalCount[cls].get(c._id)?.size ?? 0;
        const share = total > 0 ? sum / total : 0;
        rows.push({
          voterClass: VOTER_CLASS_LABEL[cls],
          voterClassWeight: w,
          candidateName: c.fullName,
          candidateMatric: c.matric ?? "—",
          evaluatorCount: evalCount,
          sumOfRubricTotals: sum,
          classGrandTotal: total,
          classShare: share,
          weightedContribution: (w / 100) * share,
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.voterClass.localeCompare(b.voterClass) ||
        b.classShare - a.classShare,
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
      for (const vote of votes)
        counts.set(vote.candidateId, (counts.get(vote.candidateId) ?? 0) + 1);
      for (const l of links) {
        const c = candidatesById.get(l.candidateId);
        if (!c) continue;
        rows.push({
          positionName: p.name,
          tier: p.tier,
          order: p.order,
          candidateName: c.fullName,
          candidateMatric: c.matric ?? "—",
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
    const election = await getElectionOrThrow(ctx, args.electionId);
    const weights = getWeights(election);

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

    const wTc = weights.topCommittee / 100;
    const wHe = weights.headExecutive / 100;
    const wY2 = weights.year2Committee / 100;
    const wPub = weights.public / 100;

    const rows: {
      positionName: string;
      tier: number;
      order: number;
      state: string;
      candidateName: string;
      candidateMatric: string;
      isWinner: boolean;
      tcShare: number;
      heShare: number;
      y2Share: number;
      publicVotes: number;
      publicShare: number;
      internalAggregate: number;
      publicAggregate: number;
      finalScore: number;
      tieBreakStep: string;
    }[] = [];

    for (const p of positions) {
      const r = resultByPosition.get(p._id);
      if (!r) continue;
      for (const b of r.breakdown) {
        const c = candidatesById.get(b.candidateId);
        const tcShare = b.tcShare ?? b.internalShare ?? 0;
        const heShare = b.heShare ?? 0;
        const y2Share = b.y2Share ?? 0;
        rows.push({
          positionName: p.name,
          tier: p.tier,
          order: p.order,
          state: r.state,
          candidateName: c?.fullName ?? "Unknown",
          candidateMatric: c?.matric ?? "—",
          isWinner: r.winnerCandidateId === b.candidateId,
          tcShare,
          heShare,
          y2Share,
          publicVotes: b.publicVotes,
          publicShare: b.publicShare,
          internalAggregate: wTc * tcShare + wHe * heShare + wY2 * y2Share,
          publicAggregate: wPub * b.publicShare,
          finalScore: b.finalScore,
          tieBreakStep: r.tieBreakStep ?? "",
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
    const whitelistByEmail = new Map<string, Doc<"internalWhitelist">>();
    for (const w of whitelist) whitelistByEmail.set(w.email, w);

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

    return voters.map((v) => {
      const wl = whitelistByEmail.get(v.email);
      return {
        email: v.email,
        fullName: v.fullName ?? "—",
        profileComplete: v.profileComplete,
        isAdmin: adminEmails.has(v.email),
        isInternalEvaluator: wl !== undefined,
        voterClass: wl ? VOTER_CLASS_LABEL[getEntryClass(wl)] : "",
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
      };
    });
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
