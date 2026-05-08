import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAdmin,
  requireCompletedProfile,
  requireVoter,
} from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import {
  getEntryClass,
  getWeights,
  VOTER_CLASSES,
  type VoterClass,
} from "./lib/cycle";
import type { Doc, Id } from "./_generated/dataModel";

async function getWhitelistEntry(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  electionId: Id<"elections">,
  email: string,
): Promise<Doc<"internalWhitelist"> | null> {
  return await ctx.db
    .query("internalWhitelist")
    .withIndex("by_election_email", (q) =>
      q.eq("electionId", electionId).eq("email", email.toLowerCase()),
    )
    .unique();
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

function classWeightFromRow(
  weights: ReturnType<typeof getWeights>,
  cls: VoterClass,
): number {
  if (cls === "topCommittee") return weights.topCommittee;
  if (cls === "headExecutive") return weights.headExecutive;
  return weights.year2Committee;
}

export const myStatus = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    const election = await getElectionOrThrow(ctx, args.electionId);
    const voter = await requireCompletedProfile(ctx);

    const whitelistEntry = await getWhitelistEntry(
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

    const voterClass = whitelistEntry ? getEntryClass(whitelistEntry) : null;
    const weights = getWeights(election);
    const weight =
      voterClass === null ? 0 : classWeightFromRow(weights, voterClass);

    return {
      phase: election.phase,
      isWhitelisted: whitelistEntry !== null,
      voterClass,
      voterClassWeight: weight,
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

    const whitelistEntry = await getWhitelistEntry(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelistEntry) return null;

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

    const criteria = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) => q.eq("electionId", election._id))
      .collect();

    return {
      electionPhase: election.phase,
      voterClass: getEntryClass(whitelistEntry),
      evaluationId: evaluation?._id ?? null,
      status: evaluation?.status ?? "draft",
      submittedAt: evaluation?.submittedAt ?? null,
      criteria: criteria
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          _id: c._id,
          name: c.name,
          maxScore: c.maxScore,
          order: c.order,
        })),
      scores: scores
        .filter((s) => s.criterionId !== undefined && s.score !== undefined)
        .map((s) => ({
          candidateId: s.candidateId,
          criterionId: s.criterionId as Id<"rubricCriteria">,
          score: s.score as number,
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
        criterionId: v.id("rubricCriteria"),
        score: v.number(),
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
    const whitelistEntry = await getWhitelistEntry(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelistEntry) {
      throw new Error(
        "You are not on the internal whitelist for this election.",
      );
    }

    const criteria = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election", (q) => q.eq("electionId", election._id))
      .collect();
    const criteriaById = new Map(criteria.map((c) => [c._id, c] as const));

    for (const s of args.scores) {
      const c = await ctx.db.get(s.candidateId);
      if (!c || c.electionId !== election._id) {
        throw new Error("Score references a candidate from another election.");
      }
      const crit = criteriaById.get(s.criterionId);
      if (!crit) {
        throw new Error("Score references an unknown rubric criterion.");
      }
      if (
        !Number.isFinite(s.score) ||
        !Number.isInteger(s.score) ||
        s.score < 1 ||
        s.score > crit.maxScore
      ) {
        throw new Error(
          `Score for "${crit.name}" must be an integer between 1 and ${crit.maxScore}.`,
        );
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
      const existing = (
        await ctx.db
          .query("internalScores")
          .withIndex("by_evaluation_candidate", (q) =>
            q
              .eq("evaluationId", evaluation._id)
              .eq("candidateId", incoming.candidateId),
          )
          .collect()
      ).find((row) => row.criterionId === incoming.criterionId);

      const payload = {
        evaluationId: evaluation._id,
        candidateId: incoming.candidateId,
        criterionId: incoming.criterionId,
        score: incoming.score,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("internalScores", payload);
      }
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
    const whitelistEntry = await getWhitelistEntry(
      ctx,
      election._id,
      voter.email,
    );
    if (!whitelistEntry) {
      throw new Error(
        "You are not on the internal whitelist for this election.",
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

    const criteria = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election", (q) => q.eq("electionId", election._id))
      .collect();

    const scoreRows = await ctx.db
      .query("internalScores")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", evaluation._id))
      .collect();

    const seen = new Set<string>();
    for (const row of scoreRows) {
      if (row.criterionId === undefined || row.score === undefined) continue;
      seen.add(`${row.candidateId}::${row.criterionId}`);
    }

    const missing: string[] = [];
    for (const c of candidates) {
      for (const crit of criteria) {
        if (!seen.has(`${c._id}::${crit._id}`)) {
          missing.push(`${c.fullName} (${crit.name})`);
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
      payload: { voterClass: getEntryClass(whitelistEntry) },
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
          ? (evalsByVoterId.get(voter._id) ?? null)
          : null;
        return {
          email: w.email,
          voterClass: getEntryClass(w),
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

    const election = await getElectionOrThrow(ctx, args.electionId);

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const criteria = await ctx.db
      .query("rubricCriteria")
      .withIndex("by_election_order", (q) =>
        q.eq("electionId", args.electionId),
      )
      .collect();
    const sortedCriteria = criteria
      .slice()
      .sort((a, b) => a.order - b.order);

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const submittedEvals = evaluations.filter((e) => e.status === "submitted");

    const evalClassMap = new Map<Id<"internalEvaluations">, VoterClass>();
    for (const ev of submittedEvals) {
      const voter = await ctx.db.get(ev.evaluatorVoterId);
      if (!voter) continue;
      const wl = await getWhitelistEntry(ctx, args.electionId, voter.email);
      if (!wl) continue;
      evalClassMap.set(ev._id, getEntryClass(wl));
    }

    const allScores = await Promise.all(
      Array.from(evalClassMap.keys()).map((id) =>
        ctx.db
          .query("internalScores")
          .withIndex("by_evaluation", (q) => q.eq("evaluationId", id))
          .collect(),
      ),
    );
    const flatScores = allScores.flat();

    type CellAgg = {
      total: number;
      count: number;
    };
    type CandidateClassAgg = {
      countEvaluators: number;
      totalSum: number;
      perCriterion: Map<Id<"rubricCriteria">, CellAgg>;
    };

    const aggregator: Record<VoterClass, Map<Id<"candidates">, CandidateClassAgg>> = {
      topCommittee: new Map(),
      headExecutive: new Map(),
      year2Committee: new Map(),
    };

    const evaluatorsByClass: Record<VoterClass, Set<Id<"internalEvaluations">>> = {
      topCommittee: new Set(),
      headExecutive: new Set(),
      year2Committee: new Set(),
    };
    for (const [evalId, cls] of evalClassMap.entries()) {
      evaluatorsByClass[cls].add(evalId);
    }

    const evalCandidateScored: Record<
      VoterClass,
      Map<Id<"candidates">, Set<Id<"internalEvaluations">>>
    > = {
      topCommittee: new Map(),
      headExecutive: new Map(),
      year2Committee: new Map(),
    };

    for (const s of flatScores) {
      if (s.criterionId === undefined || s.score === undefined) continue;
      const cls = evalClassMap.get(s.evaluationId);
      if (!cls) continue;
      const agg =
        aggregator[cls].get(s.candidateId) ??
        ({
          countEvaluators: 0,
          totalSum: 0,
          perCriterion: new Map(),
        } satisfies CandidateClassAgg);
      const cell = agg.perCriterion.get(s.criterionId) ?? {
        total: 0,
        count: 0,
      };
      cell.total += s.score;
      cell.count += 1;
      agg.perCriterion.set(s.criterionId, cell);
      agg.totalSum += s.score;
      aggregator[cls].set(s.candidateId, agg);

      const evalSet =
        evalCandidateScored[cls].get(s.candidateId) ?? new Set<Id<"internalEvaluations">>();
      evalSet.add(s.evaluationId);
      evalCandidateScored[cls].set(s.candidateId, evalSet);
    }

    for (const cls of VOTER_CLASSES) {
      for (const [candidateId, evalSet] of evalCandidateScored[cls].entries()) {
        const agg = aggregator[cls].get(candidateId);
        if (agg) agg.countEvaluators = evalSet.size;
      }
    }

    const weights = getWeights(election);

    return {
      criteria: sortedCriteria.map((c) => ({
        _id: c._id,
        name: c.name,
        maxScore: c.maxScore,
        order: c.order,
      })),
      candidates: candidates.map((c) => ({
        candidateId: c._id,
        fullName: c.fullName,
        matric: c.matric,
        byClass: VOTER_CLASSES.map((cls) => {
          const agg = aggregator[cls].get(c._id);
          return {
            voterClass: cls,
            evaluatorCount: agg?.countEvaluators ?? 0,
            totalSum: agg?.totalSum ?? 0,
            perCriterion: sortedCriteria.map((cr) => {
              const cell = agg?.perCriterion.get(cr._id);
              return {
                criterionId: cr._id,
                total: cell?.total ?? 0,
                count: cell?.count ?? 0,
                average: cell && cell.count > 0 ? cell.total / cell.count : 0,
              };
            }),
          };
        }),
      })),
      evaluatorsByClass: VOTER_CLASSES.map((cls) => ({
        voterClass: cls,
        weight: classWeightFromRow(weights, cls),
        submitted: evaluatorsByClass[cls].size,
      })),
    };
  },
});
