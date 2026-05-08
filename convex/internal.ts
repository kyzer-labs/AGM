import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  isInInternalWhitelist,
  requireAdmin,
  requireCompletedProfile,
  requireVoter,
} from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import type { Doc, Id } from "./_generated/dataModel";

const SCORE_VALIDATOR = v.number();

const RUBRIC_CATEGORIES = [
  "leadership",
  "teamwork",
  "professionalism",
  "commitment",
  "personality",
] as const;

type RubricCategory = (typeof RUBRIC_CATEGORIES)[number];

function validScore(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

async function getOrCreateMyEvaluation(
  ctx: {
    db: import("./_generated/server").MutationCtx["db"];
    auth: import("./_generated/server").MutationCtx["auth"];
  },
  electionId: Id<"elections">,
  voter: Doc<"voters">,
): Promise<Doc<"internalEvaluations">> {
  const existing = await ctx.db
    .query("internalEvaluations")
    .withIndex("by_election_evaluator", (q) =>
      q.eq("electionId", electionId).eq("evaluatorVoterId", voter._id),
    )
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("internalEvaluations", {
    electionId,
    evaluatorVoterId: voter._id,
    status: "draft",
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create evaluation row.");
  return created;
}

export const myStatus = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const election = await getElectionOrThrow(ctx, args.electionId);
    const voter = await requireCompletedProfile(ctx);

    const whitelisted = await isInInternalWhitelist(
      ctx,
      election._id,
      voter.email,
    );

    const evaluation = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election_evaluator", (q) =>
        q.eq("electionId", election._id).eq("evaluatorVoterId", voter._id),
      )
      .unique();

    return {
      phase: election.phase,
      isWhitelisted: whitelisted,
      hasEvaluation: evaluation !== null,
      evaluationStatus: evaluation?.status ?? null,
      submittedAt: evaluation?.submittedAt ?? null,
    };
  },
});

export const myEvaluation = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const election = await getElectionOrThrow(ctx, args.electionId);
    const voter = await requireCompletedProfile(ctx);

    const whitelisted = await isInInternalWhitelist(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelisted) return null;

    const evaluation = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election_evaluator", (q) =>
        q.eq("electionId", election._id).eq("evaluatorVoterId", voter._id),
      )
      .unique();

    const scores = evaluation
      ? await ctx.db
          .query("internalScores")
          .withIndex("by_evaluation", (q) =>
            q.eq("evaluationId", evaluation._id),
          )
          .collect()
      : [];

    return {
      electionPhase: election.phase,
      evaluationId: evaluation?._id ?? null,
      status: evaluation?.status ?? "draft",
      submittedAt: evaluation?.submittedAt ?? null,
      scores: scores.map((s) => ({
        candidateId: s.candidateId,
        leadership: s.leadership,
        teamwork: s.teamwork,
        professionalism: s.professionalism,
        commitment: s.commitment,
        personality: s.personality,
      })),
    };
  },
});

export const saveScores = mutation({
  args: {
    electionId: v.id("elections"),
    scores: v.array(
      v.object({
        candidateId: v.id("candidates"),
        leadership: SCORE_VALIDATOR,
        teamwork: SCORE_VALIDATOR,
        professionalism: SCORE_VALIDATOR,
        commitment: SCORE_VALIDATOR,
        personality: SCORE_VALIDATOR,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const voter = await requireVoter(ctx);
    if (!voter.profileComplete) {
      throw new Error("Complete your profile before scoring.");
    }
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "internalOpen") {
      throw new Error(
        "Internal evaluation is not open. Scores cannot be saved.",
      );
    }
    const whitelisted = await isInInternalWhitelist(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelisted) {
      throw new Error(
        "You are not on the Year 2 internal whitelist for this election.",
      );
    }

    for (const s of args.scores) {
      const c = await ctx.db.get(s.candidateId);
      if (!c || c.electionId !== election._id) {
        throw new Error("Score references a candidate from another election.");
      }
      for (const cat of RUBRIC_CATEGORIES) {
        if (!validScore(s[cat])) {
          throw new Error(
            `Score for "${cat}" must be an integer between 1 and 5.`,
          );
        }
      }
    }

    const evaluation = await getOrCreateMyEvaluation(
      ctx,
      args.electionId,
      voter,
    );
    if (evaluation.status === "submitted") {
      await ctx.db.patch(evaluation._id, {
        status: "draft",
        submittedAt: undefined,
        updatedAt: Date.now(),
      });
    }

    for (const incoming of args.scores) {
      const existing = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation_candidate", (q) =>
          q
            .eq("evaluationId", evaluation._id)
            .eq("candidateId", incoming.candidateId),
        )
        .unique();
      const payload = {
        evaluationId: evaluation._id,
        candidateId: incoming.candidateId,
        leadership: incoming.leadership,
        teamwork: incoming.teamwork,
        professionalism: incoming.professionalism,
        commitment: incoming.commitment,
        personality: incoming.personality,
      };
      if (existing) await ctx.db.patch(existing._id, payload);
      else await ctx.db.insert("internalScores", payload);
    }

    await ctx.db.patch(evaluation._id, { updatedAt: Date.now() });

    await audit(ctx, {
      actor: voter,
      action: "internal.scoresSaved",
      entityType: "internalEvaluations",
      entityId: evaluation._id,
      payload: { count: args.scores.length },
    });
  },
});

export const submit = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const voter = await requireVoter(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "internalOpen") {
      throw new Error("Internal evaluation is not open.");
    }
    const whitelisted = await isInInternalWhitelist(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelisted) {
      throw new Error(
        "You are not on the Year 2 internal whitelist for this election.",
      );
    }

    const evaluation = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election_evaluator", (q) =>
        q.eq("electionId", election._id).eq("evaluatorVoterId", voter._id),
      )
      .unique();
    if (!evaluation) {
      throw new Error("Score every candidate first, then submit.");
    }

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", election._id))
      .collect();

    const scoresByCandidate = new Map<Id<"candidates">, Doc<"internalScores">>();
    const scoreRows = await ctx.db
      .query("internalScores")
      .withIndex("by_evaluation", (q) =>
        q.eq("evaluationId", evaluation._id),
      )
      .collect();
    for (const s of scoreRows) scoresByCandidate.set(s.candidateId, s);

    const missing: string[] = [];
    for (const c of candidates) {
      const s = scoresByCandidate.get(c._id);
      if (!s) {
        missing.push(c.fullName);
        continue;
      }
      for (const cat of RUBRIC_CATEGORIES) {
        if (!validScore(s[cat])) {
          missing.push(`${c.fullName} (${cat})`);
          break;
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Cannot submit — incomplete scores for: ${missing
          .slice(0, 5)
          .join(", ")}${missing.length > 5 ? " (and more)" : ""}.`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(evaluation._id, {
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    });

    await audit(ctx, {
      actor: voter,
      action: "internal.submitted",
      entityType: "internalEvaluations",
      entityId: evaluation._id,
    });
  },
});

export const unsubmit = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const voter = await requireVoter(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "internalOpen") {
      throw new Error(
        "Internal evaluation is closed. You cannot edit a submitted evaluation now.",
      );
    }

    const evaluation = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election_evaluator", (q) =>
        q.eq("electionId", election._id).eq("evaluatorVoterId", voter._id),
      )
      .unique();
    if (!evaluation) return;
    if (evaluation.status !== "submitted") return;

    await ctx.db.patch(evaluation._id, {
      status: "draft",
      submittedAt: undefined,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "internal.unsubmitted",
      entityType: "internalEvaluations",
      entityId: evaluation._id,
    });
  },
});

export const adminCompletionList = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const evalsByVoterId = new Map<Id<"voters">, Doc<"internalEvaluations">>();
    for (const e of evaluations) {
      evalsByVoterId.set(e.evaluatorVoterId, e);
    }

    const rows = await Promise.all(
      whitelist.map(async (w) => {
        const voter = await ctx.db
          .query("voters")
          .withIndex("by_email", (q) => q.eq("email", w.email))
          .unique();
        const evaluation = voter
          ? evalsByVoterId.get(voter._id) ?? null
          : null;
        return {
          email: w.email,
          fullName: voter?.fullName ?? null,
          signedIn: voter !== null,
          status: evaluation?.status ?? "notStarted",
          submittedAt: evaluation?.submittedAt ?? null,
          updatedAt: evaluation?.updatedAt ?? null,
        };
      }),
    );

    return rows.sort((a, b) => a.email.localeCompare(b.email));
  },
});

export const adminAggregate = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const submittedEvalIds = new Set(
      evaluations.filter((e) => e.status === "submitted").map((e) => e._id),
    );

    const allScores = await Promise.all(
      Array.from(submittedEvalIds).map((id) =>
        ctx.db
          .query("internalScores")
          .withIndex("by_evaluation", (q) => q.eq("evaluationId", id))
          .collect(),
      ),
    );
    const flatScores = allScores.flat();

    const byCandidate = new Map<Id<"candidates">, Doc<"internalScores">[]>();
    for (const s of flatScores) {
      const arr = byCandidate.get(s.candidateId) ?? [];
      arr.push(s);
      byCandidate.set(s.candidateId, arr);
    }

    const rows = candidates.map((c) => {
      const scores = byCandidate.get(c._id) ?? [];
      const n = scores.length;
      const totals: Record<RubricCategory, number> = {
        leadership: 0,
        teamwork: 0,
        professionalism: 0,
        commitment: 0,
        personality: 0,
      };
      for (const s of scores) {
        for (const cat of RUBRIC_CATEGORIES) totals[cat] += s[cat];
      }
      const avgs: Record<RubricCategory, number> = {
        leadership: n > 0 ? totals.leadership / n : 0,
        teamwork: n > 0 ? totals.teamwork / n : 0,
        professionalism: n > 0 ? totals.professionalism / n : 0,
        commitment: n > 0 ? totals.commitment / n : 0,
        personality: n > 0 ? totals.personality / n : 0,
      };
      const overall =
        n > 0
          ? (avgs.leadership +
              avgs.teamwork +
              avgs.professionalism +
              avgs.commitment +
              avgs.personality) /
            5
          : 0;
      return {
        candidateId: c._id,
        fullName: c.fullName,
        matric: c.matric,
        evaluatorCount: n,
        averages: avgs,
        overall,
      };
    });

    rows.sort((a, b) => b.overall - a.overall || a.fullName.localeCompare(b.fullName));
    return rows;
  },
});
