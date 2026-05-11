/**
 * Dev-only seed module. Lets a signed-in admin populate fake voters,
 * whitelist entries, internal evaluations, and public votes so the
 * scoring math, cascade, and tie-break ladder can be exercised without
 * needing dozens of real `@student.usm.my` accounts.
 *
 * SAFETY:
 *   - Every mutation requires the `DEV_SEED_ALLOWED` env var to be set
 *     to the literal string `"true"` on the Convex deployment. In
 *     production, simply leave it unset and every entry point throws.
 *   - Every mutation also requires an authenticated admin caller.
 *   - All seeded rows use a synthetic email shape:
 *       `seed-<class>-<nnn>-<short>@student.usm.my`
 *     where `<short>` is the last 8 characters of the election ID.
 *     `wipeSeedData` deletes only rows matching that exact prefix +
 *     election shard, so production data is untouched even if the env
 *     var is accidentally enabled.
 *   - Audit entries from this module use the `dev.seed*` action prefix
 *     so they're easy to filter from the production audit log.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { normalisePhotoUrl } from "./lib/photoUrl";
import { getElectionOrThrow } from "./lib/setup";
import { VOTER_CLASSES, type VoterClass } from "./lib/cycle";

// ---------- env gate ----------

const SEED_EMAIL_PREFIX = "seed-";
const USM_DOMAIN = "@student.usm.my";

/**
 * Marker prefix written into the `bio` field of every fixture candidate
 * inserted by `loadTestCandidates`. Wipes target only rows whose bio
 * starts with this exact string so real candidate rows entered through
 * `/admin/candidates` are never touched, even with the env flag on.
 */
const TEST_BIO_PREFIX = "[TEST_FIXTURE]";

function isSeedEnabled(): boolean {
  return process.env.DEV_SEED_ALLOWED === "true";
}

function requireSeedEnabled(): void {
  if (!isSeedEnabled()) {
    throw new ConvexError(
      "Dev seeder is disabled on this deployment. Set DEV_SEED_ALLOWED=\"true\" in the Convex deployment env to enable.",
    );
  }
}

function isTestBio(bio: string | undefined | null): boolean {
  return typeof bio === "string" && bio.startsWith(TEST_BIO_PREFIX);
}

// ---------- email helpers ----------

type SeedKind = "tc" | "he" | "y2" | "ext";

const CLASS_SHORT: Record<VoterClass, SeedKind> = {
  topCommittee: "tc",
  headExecutive: "he",
  year2Committee: "y2",
};

function shortElectionId(electionId: Id<"elections">): string {
  return electionId.slice(-8);
}

function seedEmail(
  electionId: Id<"elections">,
  kind: SeedKind,
  index: number,
): string {
  const num = String(index).padStart(3, "0");
  return `${SEED_EMAIL_PREFIX}${kind}-${num}-${shortElectionId(electionId)}${USM_DOMAIN}`;
}

function isSeedEmail(email: string): boolean {
  return email.startsWith(SEED_EMAIL_PREFIX) && email.endsWith(USM_DOMAIN);
}

function isSeedEmailForElection(
  email: string,
  electionId: Id<"elections">,
): boolean {
  if (!isSeedEmail(email)) return false;
  const tail = `-${shortElectionId(electionId)}${USM_DOMAIN}`;
  return email.endsWith(tail);
}

// ---------- seeded PRNG (deterministic per call) ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ---------- shared helpers ----------

const VOTER_CLASS_VALIDATOR = v.union(
  v.literal("topCommittee"),
  v.literal("headExecutive"),
  v.literal("year2Committee"),
);

const DISTRIBUTION_VALIDATOR = v.union(
  v.literal("uniform"),
  v.literal("perfect"),
  v.literal("favorFirst"),
);

const VOTE_TALLY_KIND_VALIDATOR = v.union(
  v.literal("uniform"),
  v.literal("favorFirst"),
);

type Distribution = "uniform" | "perfect" | "favorFirst";
type VoteTallyKind = "uniform" | "favorFirst";

interface PerClassCounts {
  topCommittee: number;
  headExecutive: number;
  year2Committee: number;
}

const PER_CLASS_VALIDATOR = v.object({
  topCommittee: v.number(),
  headExecutive: v.number(),
  year2Committee: v.number(),
});

async function findExistingSeedVoter(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  email: string,
): Promise<Doc<"voters"> | null> {
  return await ctx.db
    .query("voters")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

async function ensureSeedVoter(
  ctx: MutationCtx,
  email: string,
  fullName: string,
  matric: string,
): Promise<Doc<"voters">> {
  const existing = await findExistingSeedVoter(ctx, email);
  if (existing) return existing;

  const id = await ctx.db.insert("voters", {
    tokenIdentifier: `seed:${email}`,
    email,
    firebaseUid: `seed_uid_${email}`,
    fullName,
    matric,
    yearOfStudy: 2,
    profileComplete: true,
    createdAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new ConvexError("Failed to create seeded voter (unexpected).");
  }
  return created;
}

async function listSeedVotersForElection(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  electionId: Id<"elections">,
): Promise<Doc<"voters">[]> {
  const all = await ctx.db.query("voters").collect();
  return all.filter((v) => isSeedEmailForElection(v.email, electionId));
}

async function listSeedWhitelistForElection(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  electionId: Id<"elections">,
): Promise<Doc<"internalWhitelist">[]> {
  const rows = await ctx.db
    .query("internalWhitelist")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
  return rows.filter((r) => isSeedEmail(r.email));
}

async function getCandidatesForElection(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  electionId: Id<"elections">,
): Promise<Doc<"candidates">[]> {
  return await ctx.db
    .query("candidates")
    .withIndex("by_election", (q) => q.eq("electionId", electionId))
    .collect();
}

async function getCriteriaForElection(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  electionId: Id<"elections">,
): Promise<Doc<"rubricCriteria">[]> {
  const rows = await ctx.db
    .query("rubricCriteria")
    .withIndex("by_election_order", (q) => q.eq("electionId", electionId))
    .collect();
  return rows.slice().sort((a, b) => a.order - b.order);
}

// ---------- queries ----------

export const config = query({
  args: {},
  handler: async () => {
    return { enabled: isSeedEnabled() };
  },
});

export const stats = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    if (!isSeedEnabled()) return null;
    await requireAdmin(ctx);
    await getElectionOrThrow(ctx, args.electionId);

    const allVoters = await ctx.db.query("voters").collect();
    const seedVoters = allVoters.filter((vDoc) =>
      isSeedEmailForElection(vDoc.email, args.electionId),
    );
    const totalRealVoters = allVoters.filter(
      (vDoc) => !isSeedEmail(vDoc.email),
    ).length;

    const seedVoterEmails = new Set(seedVoters.map((s) => s.email));
    const seedVoterIds = new Set<Id<"voters">>(seedVoters.map((s) => s._id));

    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const seedWhitelist = whitelist.filter((w) => isSeedEmail(w.email));
    const realWhitelist = whitelist.length - seedWhitelist.length;

    const seedWhitelistByClass: Record<VoterClass, number> = {
      topCommittee: 0,
      headExecutive: 0,
      year2Committee: 0,
    };
    for (const w of seedWhitelist) {
      seedWhitelistByClass[w.voterClass ?? "year2Committee"] += 1;
    }

    const evals = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const seedEvals = evals.filter((e) => seedVoterIds.has(e.evaluatorVoterId));
    const seedSubmittedEvals = seedEvals.filter(
      (e) => e.status === "submitted",
    );

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    let allVotes = 0;
    let seedVotes = 0;
    const sessionCounts = { pending: 0, active: 0, closed: 0 };
    for (const p of positions) {
      const votes = await ctx.db
        .query("publicVotes")
        .withIndex("by_position", (q) => q.eq("positionId", p._id))
        .collect();
      allVotes += votes.length;
      for (const vote of votes) {
        const voter = await ctx.db.get(vote.voterVoterId);
        if (voter && seedVoterEmails.has(voter.email)) seedVotes += 1;
      }
      sessionCounts[p.sessionStatus] += 1;
    }

    const candidates = await getCandidatesForElection(ctx, args.electionId);
    const testCandidates = candidates.filter((c) => isTestBio(c.bio));
    const realCandidates = candidates.length - testCandidates.length;

    const candidatesByPosition = new Map<
      string,
      { _id: Id<"candidates">; fullName: string; isTest: boolean }[]
    >();
    for (const c of candidates) {
      const links = await ctx.db
        .query("candidatePositions")
        .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
        .collect();
      for (const link of links) {
        const arr = candidatesByPosition.get(link.positionId) ?? [];
        arr.push({
          _id: c._id,
          fullName: c.fullName,
          isTest: isTestBio(c.bio),
        });
        candidatesByPosition.set(link.positionId, arr);
      }
    }

    const firstByPosition = positions
      .slice()
      .sort((a, b) =>
        a.tier === b.tier ? a.order - b.order : a.tier - b.tier,
      )
      .map((p) => {
        const cands = (candidatesByPosition.get(p._id) ?? [])
          .slice()
          .sort((a, b) => a._id.localeCompare(b._id));
        return {
          positionId: p._id,
          positionName: p.name,
          tier: p.tier,
          order: p.order,
          sessionStatus: p.sessionStatus,
          candidatesAtPosition: cands.length,
          favorFirstWinner: cands[0]
            ? {
                fullName: cands[0].fullName,
                isTest: cands[0].isTest,
              }
            : null,
        };
      });

    const results = await ctx.db
      .query("results")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    return {
      shortElectionId: shortElectionId(args.electionId),
      seedVoters: seedVoters.length,
      totalRealVoters,
      seedWhitelistByClass,
      realWhitelist,
      seedEvaluationsTotal: seedEvals.length,
      seedEvaluationsSubmitted: seedSubmittedEvals.length,
      seedPublicVotes: seedVotes,
      totalPublicVotes: allVotes,
      candidates: {
        total: candidates.length,
        test: testCandidates.length,
        real: realCandidates,
      },
      positions: positions.length,
      sessionCounts,
      results: results.length,
      firstByPosition,
    };
  },
});

// ---------- mutations: voters + whitelist ----------

export const seedEvaluatorVoters = mutation({
  args: {
    electionId: v.id("elections"),
    perClass: PER_CLASS_VALIDATOR,
  },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "setup" && election.phase !== "internalOpen") {
      throw new ConvexError(
        "Seed evaluators is only available during Setup or Internal Open phases.",
      );
    }

    const counts: PerClassCounts = {
      topCommittee: Math.max(0, Math.floor(args.perClass.topCommittee)),
      headExecutive: Math.max(0, Math.floor(args.perClass.headExecutive)),
      year2Committee: Math.max(0, Math.floor(args.perClass.year2Committee)),
    };

    let inserted = 0;
    let reused = 0;
    let whitelistInserted = 0;
    let whitelistReused = 0;

    for (const cls of VOTER_CLASSES) {
      const target = counts[cls];
      const short = CLASS_SHORT[cls];
      for (let i = 1; i <= target; i++) {
        const email = seedEmail(args.electionId, short, i);
        const existing = await findExistingSeedVoter(ctx, email);
        if (existing) {
          reused += 1;
        } else {
          await ensureSeedVoter(
            ctx,
            email,
            `Seed ${cls} ${String(i).padStart(2, "0")}`,
            `SEED${short.toUpperCase()}${String(i).padStart(3, "0")}`,
          );
          inserted += 1;
        }

        const wl = await ctx.db
          .query("internalWhitelist")
          .withIndex("by_election_email", (q) =>
            q.eq("electionId", args.electionId).eq("email", email),
          )
          .unique();
        if (wl) {
          if (wl.voterClass !== cls) {
            await ctx.db.patch(wl._id, { voterClass: cls });
          }
          whitelistReused += 1;
        } else {
          await ctx.db.insert("internalWhitelist", {
            electionId: args.electionId,
            email,
            voterClass: cls,
            addedByVoterId: actor._id,
            addedAt: Date.now(),
          });
          whitelistInserted += 1;
        }
      }
    }

    await audit(ctx, {
      actor,
      action: "dev.seedEvaluatorVoters",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        topCommittee: counts.topCommittee,
        headExecutive: counts.headExecutive,
        year2Committee: counts.year2Committee,
        votersInserted: inserted,
        votersReused: reused,
        whitelistInserted,
        whitelistReused,
      },
    });

    return {
      votersInserted: inserted,
      votersReused: reused,
      whitelistInserted,
      whitelistReused,
    };
  },
});

export const seedExternalVoters = mutation({
  args: {
    electionId: v.id("elections"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    await getElectionOrThrow(ctx, args.electionId);

    const target = Math.max(0, Math.floor(args.count));
    let inserted = 0;
    let reused = 0;

    for (let i = 1; i <= target; i++) {
      const email = seedEmail(args.electionId, "ext", i);
      const existing = await findExistingSeedVoter(ctx, email);
      if (existing) {
        reused += 1;
      } else {
        await ensureSeedVoter(
          ctx,
          email,
          `Seed external ${String(i).padStart(3, "0")}`,
          `SEEDEXT${String(i).padStart(3, "0")}`,
        );
        inserted += 1;
      }
    }

    await audit(ctx, {
      actor,
      action: "dev.seedExternalVoters",
      entityType: "elections",
      entityId: args.electionId,
      payload: { inserted, reused, requested: target },
    });

    return { inserted, reused };
  },
});

// ---------- mutations: internal evaluations ----------

function computeScoreForCriterion(
  rand: () => number,
  distribution: Distribution,
  candidateRank: number,
  candidateCount: number,
  maxScore: number,
): number {
  if (distribution === "perfect") {
    return maxScore;
  }
  if (distribution === "favorFirst") {
    if (candidateRank === 0) return maxScore;
    if (candidateCount <= 1) return maxScore;
    const rest = Math.max(1, Math.floor(maxScore * 0.3));
    return Math.max(1, Math.min(maxScore, rest));
  }
  return randomInt(rand, 1, maxScore);
}

export const seedInternalEvaluations = mutation({
  args: {
    electionId: v.id("elections"),
    distribution: DISTRIBUTION_VALIDATOR,
    submitted: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (
      election.phase !== "setup" &&
      election.phase !== "internalOpen" &&
      election.phase !== "internalClosed"
    ) {
      throw new ConvexError(
        "Seed internal evaluations is only available before public voting opens.",
      );
    }

    const seedWhitelist = await listSeedWhitelistForElection(
      ctx,
      args.electionId,
    );
    if (seedWhitelist.length === 0) {
      throw new ConvexError(
        "No seeded whitelist entries for this election. Run \"Seed evaluator voters\" first.",
      );
    }

    const candidates = await getCandidatesForElection(ctx, args.electionId);
    if (candidates.length === 0) {
      throw new ConvexError(
        "No candidates configured. Add candidates before seeding evaluations.",
      );
    }
    const sortedCandidates = candidates
      .slice()
      .sort((a, b) => a._id.localeCompare(b._id));

    const criteria = await getCriteriaForElection(ctx, args.electionId);
    if (criteria.length === 0) {
      throw new ConvexError(
        "No rubric criteria configured for this election.",
      );
    }

    let evaluatorsTouched = 0;
    let scoresWritten = 0;
    let evaluationsSubmitted = 0;

    for (const w of seedWhitelist) {
      const evaluator = await findExistingSeedVoter(ctx, w.email);
      if (!evaluator) continue;
      evaluatorsTouched += 1;

      const seed = hashStringToInt(`${args.distribution}|${evaluator._id}`);
      const rand = mulberry32(seed);

      let evaluation = await ctx.db
        .query("internalEvaluations")
        .withIndex("by_election_evaluator", (q) =>
          q
            .eq("electionId", args.electionId)
            .eq("evaluatorVoterId", evaluator._id),
        )
        .unique();
      if (!evaluation) {
        const id = await ctx.db.insert("internalEvaluations", {
          electionId: args.electionId,
          evaluatorVoterId: evaluator._id,
          status: "draft",
          updatedAt: Date.now(),
        });
        const created = await ctx.db.get(id);
        if (!created) continue;
        evaluation = created;
      }

      for (let i = 0; i < sortedCandidates.length; i++) {
        const candidate = sortedCandidates[i];
        if (!candidate) continue;
        for (const crit of criteria) {
          const score = computeScoreForCriterion(
            rand,
            args.distribution,
            i,
            sortedCandidates.length,
            crit.maxScore,
          );
          const existing = (
            await ctx.db
              .query("internalScores")
              .withIndex("by_evaluation_candidate", (q) =>
                q
                  .eq("evaluationId", evaluation._id)
                  .eq("candidateId", candidate._id),
              )
              .collect()
          ).find((row) => row.criterionId === crit._id);

          const payload = {
            evaluationId: evaluation._id,
            candidateId: candidate._id,
            criterionId: crit._id,
            score,
          };
          if (existing) {
            await ctx.db.patch(existing._id, payload);
          } else {
            await ctx.db.insert("internalScores", payload);
          }
          scoresWritten += 1;
        }
      }

      const now = Date.now();
      if (args.submitted) {
        await ctx.db.patch(evaluation._id, {
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        });
        evaluationsSubmitted += 1;
      } else {
        await ctx.db.patch(evaluation._id, {
          status: "draft",
          submittedAt: undefined,
          updatedAt: now,
        });
      }
    }

    await audit(ctx, {
      actor,
      action: "dev.seedInternalEvaluations",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        distribution: args.distribution,
        submitted: args.submitted,
        evaluatorsTouched,
        evaluationsSubmitted,
        scoresWritten,
        candidates: sortedCandidates.length,
        criteria: criteria.length,
      },
    });

    return {
      evaluatorsTouched,
      evaluationsSubmitted,
      scoresWritten,
    };
  },
});

// ---------- mutations: public votes ----------

interface VoteAllocation {
  candidateId: Id<"candidates">;
  votes: number;
}

function allocateVotes(
  candidateIds: Id<"candidates">[],
  totalVotes: number,
  kind: VoteTallyKind,
): VoteAllocation[] {
  const n = candidateIds.length;
  if (n === 0 || totalVotes <= 0) {
    return candidateIds.map((id) => ({ candidateId: id, votes: 0 }));
  }
  if (kind === "uniform") {
    const base = Math.floor(totalVotes / n);
    const remainder = totalVotes - base * n;
    return candidateIds.map((id, idx) => ({
      candidateId: id,
      votes: base + (idx < remainder ? 1 : 0),
    }));
  }
  // favorFirst: first candidate gets ~70%, rest split evenly
  const first = Math.round(totalVotes * 0.7);
  const remaining = totalVotes - first;
  if (n === 1) {
    return [{ candidateId: candidateIds[0]!, votes: totalVotes }];
  }
  const rest = n - 1;
  const restBase = Math.floor(remaining / rest);
  const restRemainder = remaining - restBase * rest;
  return candidateIds.map((id, idx) => {
    if (idx === 0) return { candidateId: id, votes: first };
    return {
      candidateId: id,
      votes: restBase + (idx - 1 < restRemainder ? 1 : 0),
    };
  });
}

async function getEligibleCandidatesForPosition(
  ctx: { db: QueryCtx["db"] | MutationCtx["db"] },
  positionId: Id<"positions">,
): Promise<Id<"candidates">[]> {
  const links = await ctx.db
    .query("candidatePositions")
    .withIndex("by_position", (q) => q.eq("positionId", positionId))
    .collect();
  return links
    .slice()
    .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
    .map((l) => l.candidateId);
}

export const seedPublicVotes = mutation({
  args: {
    electionId: v.id("elections"),
    totalVotesPerPosition: v.number(),
    kind: VOTE_TALLY_KIND_VALIDATOR,
  },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);

    const total = Math.max(0, Math.floor(args.totalVotesPerPosition));
    if (total === 0) {
      return { positionsTouched: 0, votesInserted: 0, externalVotersUsed: 0 };
    }

    const externalVoters = (
      await listSeedVotersForElection(ctx, args.electionId)
    ).filter((vDoc) => {
      // exclude whitelisted ones; only "ext" prefix qualifies
      return vDoc.email.startsWith(`${SEED_EMAIL_PREFIX}ext-`);
    });
    if (externalVoters.length < total) {
      throw new ConvexError(
        `Need at least ${total} seeded external voters but only ${externalVoters.length} exist. Run \"Seed external voters\" first.`,
      );
    }

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    let positionsTouched = 0;
    let votesInserted = 0;
    const externalVotersUsed = new Set<Id<"voters">>();

    for (const position of positions) {
      const eligible = await getEligibleCandidatesForPosition(
        ctx,
        position._id,
      );
      if (eligible.length === 0) continue;

      const allocations = allocateVotes(eligible, total, args.kind);

      // Build a flat queue of candidate IDs based on allocations
      const queue: Id<"candidates">[] = [];
      for (const a of allocations) {
        for (let i = 0; i < a.votes; i++) queue.push(a.candidateId);
      }

      // Use the first `total` external voters to vote
      for (let i = 0; i < queue.length; i++) {
        const externalVoter = externalVoters[i];
        if (!externalVoter) break;
        const candidateId = queue[i];
        if (!candidateId) continue;

        const existing = await ctx.db
          .query("publicVotes")
          .withIndex("by_position_voter", (q) =>
            q
              .eq("positionId", position._id)
              .eq("voterVoterId", externalVoter._id),
          )
          .unique();
        if (existing) {
          if (existing.candidateId !== candidateId) {
            await ctx.db.patch(existing._id, {
              candidateId,
              votedAt: Date.now(),
            });
          }
        } else {
          await ctx.db.insert("publicVotes", {
            electionId: election._id,
            positionId: position._id,
            voterVoterId: externalVoter._id,
            candidateId,
            votedAt: Date.now(),
          });
          votesInserted += 1;
        }
        externalVotersUsed.add(externalVoter._id);
      }
      positionsTouched += 1;
    }

    await audit(ctx, {
      actor,
      action: "dev.seedPublicVotes",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        kind: args.kind,
        totalVotesPerPosition: total,
        positionsTouched,
        votesInserted,
        externalVotersUsed: externalVotersUsed.size,
      },
    });

    return {
      positionsTouched,
      votesInserted,
      externalVotersUsed: externalVotersUsed.size,
    };
  },
});

// ---------- engineered tie ----------

export const engineerTieAtPosition = mutation({
  args: {
    positionId: v.id("positions"),
    votesPerTopCandidate: v.number(),
  },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);

    const position = await ctx.db.get(args.positionId);
    if (!position) throw new ConvexError("Position not found.");
    const election = await getElectionOrThrow(ctx, position.electionId);

    const eligible = await getEligibleCandidatesForPosition(ctx, position._id);
    if (eligible.length < 2) {
      throw new ConvexError(
        "Need at least 2 eligible candidates on this position to engineer a tie.",
      );
    }
    const top = eligible.slice(0, 2);

    const externalVoters = (
      await listSeedVotersForElection(ctx, election._id)
    ).filter((vDoc) =>
      vDoc.email.startsWith(`${SEED_EMAIL_PREFIX}ext-`),
    );
    const perCandidate = Math.max(1, Math.floor(args.votesPerTopCandidate));
    const required = perCandidate * top.length;
    if (externalVoters.length < required) {
      throw new ConvexError(
        `Need ${required} seeded external voters, only ${externalVoters.length} exist.`,
      );
    }

    let votesInserted = 0;
    for (let i = 0; i < top.length; i++) {
      const candidateId = top[i];
      if (!candidateId) continue;
      for (let j = 0; j < perCandidate; j++) {
        const idx = i * perCandidate + j;
        const externalVoter = externalVoters[idx];
        if (!externalVoter) continue;

        const existing = await ctx.db
          .query("publicVotes")
          .withIndex("by_position_voter", (q) =>
            q
              .eq("positionId", position._id)
              .eq("voterVoterId", externalVoter._id),
          )
          .unique();
        if (existing) {
          if (existing.candidateId !== candidateId) {
            await ctx.db.patch(existing._id, {
              candidateId,
              votedAt: Date.now(),
            });
          }
        } else {
          await ctx.db.insert("publicVotes", {
            electionId: election._id,
            positionId: position._id,
            voterVoterId: externalVoter._id,
            candidateId,
            votedAt: Date.now(),
          });
          votesInserted += 1;
        }
      }
    }

    // Set every seeded evaluator to give the top two candidates identical
    // total scores so internal shares match exactly.
    const seedWhitelist = await listSeedWhitelistForElection(
      ctx,
      election._id,
    );
    const criteria = await getCriteriaForElection(ctx, election._id);
    const candidates = await getCandidatesForElection(ctx, election._id);
    const sortedCandidates = candidates
      .slice()
      .sort((a, b) => a._id.localeCompare(b._id));

    let scoresWritten = 0;
    for (const w of seedWhitelist) {
      const evaluator = await findExistingSeedVoter(ctx, w.email);
      if (!evaluator) continue;
      let evaluation = await ctx.db
        .query("internalEvaluations")
        .withIndex("by_election_evaluator", (q) =>
          q
            .eq("electionId", election._id)
            .eq("evaluatorVoterId", evaluator._id),
        )
        .unique();
      if (!evaluation) {
        const id = await ctx.db.insert("internalEvaluations", {
          electionId: election._id,
          evaluatorVoterId: evaluator._id,
          status: "submitted",
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        });
        const created = await ctx.db.get(id);
        if (!created) continue;
        evaluation = created;
      } else {
        await ctx.db.patch(evaluation._id, {
          status: "submitted",
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const topSet = new Set<string>(top);
      for (const candidate of sortedCandidates) {
        for (const crit of criteria) {
          const score = topSet.has(candidate._id) ? crit.maxScore : 1;
          const existing = (
            await ctx.db
              .query("internalScores")
              .withIndex("by_evaluation_candidate", (q) =>
                q
                  .eq("evaluationId", evaluation._id)
                  .eq("candidateId", candidate._id),
              )
              .collect()
          ).find((row) => row.criterionId === crit._id);

          const payload = {
            evaluationId: evaluation._id,
            candidateId: candidate._id,
            criterionId: crit._id,
            score,
          };
          if (existing) {
            await ctx.db.patch(existing._id, payload);
          } else {
            await ctx.db.insert("internalScores", payload);
          }
          scoresWritten += 1;
        }
      }
    }

    await audit(ctx, {
      actor,
      action: "dev.engineerTieAtPosition",
      entityType: "positions",
      entityId: position._id,
      payload: {
        votesPerTopCandidate: perCandidate,
        votesInserted,
        scoresWritten,
        topCandidates: top.length,
      },
    });

    return {
      votesInserted,
      scoresWritten,
      topCandidateIds: top,
    };
  },
});

// ---------- wipe ----------

export const wipeSeedData = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase === "published") {
      throw new ConvexError(
        "Cannot wipe seed data once the cycle is published. Create a new cycle for further testing.",
      );
    }

    const seedVoters = await listSeedVotersForElection(ctx, args.electionId);
    const seedVoterIds = new Set<Id<"voters">>(seedVoters.map((v) => v._id));

    let votesDeleted = 0;
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const p of positions) {
      const votes = await ctx.db
        .query("publicVotes")
        .withIndex("by_position", (q) => q.eq("positionId", p._id))
        .collect();
      for (const vote of votes) {
        if (seedVoterIds.has(vote.voterVoterId)) {
          await ctx.db.delete(vote._id);
          votesDeleted += 1;
        }
      }
    }

    let scoresDeleted = 0;
    let evaluationsDeleted = 0;
    const evals = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const e of evals) {
      if (!seedVoterIds.has(e.evaluatorVoterId)) continue;
      const scores = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", e._id))
        .collect();
      for (const s of scores) {
        await ctx.db.delete(s._id);
        scoresDeleted += 1;
      }
      await ctx.db.delete(e._id);
      evaluationsDeleted += 1;
    }

    let whitelistDeleted = 0;
    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const w of whitelist) {
      if (!isSeedEmail(w.email)) continue;
      await ctx.db.delete(w._id);
      whitelistDeleted += 1;
    }

    let votersDeleted = 0;
    for (const v2 of seedVoters) {
      await ctx.db.delete(v2._id);
      votersDeleted += 1;
    }

    let resultsCleared = 0;
    const results = await ctx.db
      .query("results")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const r of results) {
      await ctx.db.delete(r._id);
      resultsCleared += 1;
    }

    let positionsReset = 0;
    for (const p of positions) {
      if (p.sessionStatus !== "pending") {
        await ctx.db.patch(p._id, {
          sessionStatus: "pending",
          sessionStartedAt: undefined,
          sessionClosedAt: undefined,
        });
        positionsReset += 1;
      }
    }

    await audit(ctx, {
      actor,
      action: "dev.wipeSeedData",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        votersDeleted,
        whitelistDeleted,
        evaluationsDeleted,
        scoresDeleted,
        votesDeleted,
        resultsCleared,
        positionsReset,
      },
    });

    return {
      votersDeleted,
      whitelistDeleted,
      evaluationsDeleted,
      scoresDeleted,
      votesDeleted,
      resultsCleared,
      positionsReset,
    };
  },
});

// ---------- test candidate fixtures ----------

interface TestCandidateSpec {
  fullName: string;
  matric: string;
  positionTier: number;
  positionOrder: number;
  photoUrl: string;
}

/**
 * Eighteen seeded fixture candidates: two per position across the
 * canonical Year 2 cycle. Position assignments are anchored to
 * (tier, order) which is how `positions` is identified independent of
 * its display name. A position whose seed defaults have been renamed
 * still resolves correctly here because the (tier, order) coordinates
 * survive renames.
 */
const TEST_CANDIDATES: ReadonlyArray<TestCandidateSpec> = [
  // Tier 1 - President (1 position)
  {
    fullName: "Lim Pei Xuan",
    matric: "FIXT0001A",
    positionTier: 1,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1QYwdEiiOpW6rpBMzACqvSG2oNVJUcRtg/view?usp=drivesdk",
  },
  {
    fullName: "Tan Chin Qian",
    matric: "FIXT0001B",
    positionTier: 1,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1Zn5f3zBM5jbLG7ZDoXpLfcV6bUWfy6WT/view?usp=drivesdk",
  },

  // Tier 2 - Vice Presidents (2 positions)
  {
    fullName: "Kyzer Phneh",
    matric: "FIXT0002A",
    positionTier: 2,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1A9NqzhdPkoInA34oLF8jLSPWsAxypscI/view?usp=drivesdk",
  },
  {
    fullName: "Lim Jie Shen",
    matric: "FIXT0002B",
    positionTier: 2,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1NINWvOT4sl72xyb9CuYzzjvpzRwkRxt2/view?usp=drivesdk",
  },
  {
    fullName: "Doris Yee Wai Lee",
    matric: "FIXT0003A",
    positionTier: 2,
    positionOrder: 1,
    photoUrl:
      "https://drive.google.com/file/d/1Zn-f8pqm2aLFrFi3s2igTjLWjwi2XK9x/view?usp=drivesdk",
  },
  {
    fullName: "Auni Amira Binti Md Fauzi",
    matric: "FIXT0003B",
    positionTier: 2,
    positionOrder: 1,
    photoUrl:
      "https://drive.google.com/file/d/16XVsA4PnCVqaUZ-o7qFmU5bcETSF3LxP/view?usp=drivesdk",
  },

  // Tier 3 - Directors (6 positions)
  {
    fullName: "Koay Phing Hong",
    matric: "FIXT0004A",
    positionTier: 3,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1dzytCdjqpLlG-sbMKD3uLhWV5ipm-4Lk/view?usp=drivesdk",
  },
  {
    fullName: "Koay Ke Ying",
    matric: "FIXT0004B",
    positionTier: 3,
    positionOrder: 0,
    photoUrl:
      "https://drive.google.com/file/d/1kHWUxjJgpt_2shk-VaqENSES6kPQweI2/view?usp=drivesdk",
  },
  {
    fullName: "Nurul Shafina Ashikin Binti Mohd Redda Udin",
    matric: "FIXT0005A",
    positionTier: 3,
    positionOrder: 1,
    photoUrl:
      "https://drive.google.com/file/d/1P3-aO-mn87tbOoYb_oLDc89dfUIOohf7/view?usp=drivesdk",
  },
  {
    fullName: "Nurrul Shahiratulnazwa",
    matric: "FIXT0005B",
    positionTier: 3,
    positionOrder: 1,
    photoUrl:
      "https://drive.google.com/file/d/1vUOiBwynrATpCAYwEXe_wo_iFXClYtHV/view?usp=drivesdk",
  },
  {
    fullName: "Loh Wei Chuen",
    matric: "FIXT0006A",
    positionTier: 3,
    positionOrder: 2,
    photoUrl:
      "https://drive.google.com/file/d/1ALveRb-PZryydA6bf9KujPQepB2AaF5b/view?usp=drivesdk",
  },
  {
    fullName: "Chong Han Zheng",
    matric: "FIXT0006B",
    positionTier: 3,
    positionOrder: 2,
    photoUrl:
      "https://drive.google.com/file/d/1HbvB2aEEnNsLTSFMGUXHjbXBlGXEnrvs/view?usp=drivesdk",
  },
  {
    fullName: "Lau Jun Hao",
    matric: "FIXT0007A",
    positionTier: 3,
    positionOrder: 3,
    photoUrl:
      "https://drive.google.com/file/d/13X2_35uXBZXBUdXhbViCLiD6R1WN5cuM/view?usp=drivesdk",
  },
  {
    fullName: "Mohamad Nazrul Hakim Bin Noor Hamzah",
    matric: "FIXT0007B",
    positionTier: 3,
    positionOrder: 3,
    photoUrl:
      "https://drive.google.com/file/d/1hi_577Vvj_Hf3_V3nbBop2T48WeVhbXm/view?usp=drivesdk",
  },
  {
    fullName: "Cheng Xin Yi",
    matric: "FIXT0008A",
    positionTier: 3,
    positionOrder: 4,
    photoUrl:
      "https://drive.google.com/file/d/10O11lBj7NOXk9wJXKK74AfEwveLLZO-9/view?usp=drivesdk",
  },
  {
    fullName: "Yap Han Lim",
    matric: "FIXT0008B",
    positionTier: 3,
    positionOrder: 4,
    photoUrl:
      "https://drive.google.com/file/d/1QJzVBM59e157E9XEcr7kSWaN3YJ5EPkM/view?usp=drivesdk",
  },
  {
    fullName: "Muhammad Adam Zayani Bin Mohd Huzainy",
    matric: "FIXT0009A",
    positionTier: 3,
    positionOrder: 5,
    photoUrl:
      "https://drive.google.com/file/d/1CD0fz1NGKt0FC2H7rT8Yptesmw0FJHTE/view?usp=drivesdk",
  },
  {
    fullName: "Calvin Khoo Zhen Chen",
    matric: "FIXT0009B",
    positionTier: 3,
    positionOrder: 5,
    photoUrl:
      "https://drive.google.com/file/d/1U2XM0jBrfP6ZV4Xg0Qf8LVyUvpxeuNNj/view?usp=drivesdk",
  },
];

export const loadTestCandidates = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "setup") {
      throw new ConvexError(
        `Test candidates can only be loaded during the Setup phase. Current phase: ${election.phase}. Wipe and reset this cycle, or open /admin/candidates to add real candidates instead.`,
      );
    }

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    if (positions.length === 0) {
      throw new ConvexError(
        "No positions configured. Run \"Seed defaults\" on /admin/positions first, then load test candidates.",
      );
    }

    const positionByKey = new Map<string, (typeof positions)[number]>();
    for (const p of positions) {
      positionByKey.set(`${p.tier}-${p.order}`, p);
    }

    const existingCandidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const existingTestCandidates = existingCandidates.filter((c) =>
      isTestBio(c.bio),
    );
    const existingTestByName = new Map(
      existingTestCandidates.map((c) => [c.fullName, c]),
    );
    const existingTestByMatric = new Map(
      existingTestCandidates
        .filter((c) => typeof c.matric === "string")
        .map((c) => [c.matric as string, c]),
    );

    let inserted = 0;
    let skipped = 0;
    let updated = 0;
    const missingPositions: string[] = [];

    for (const spec of TEST_CANDIDATES) {
      const position = positionByKey.get(
        `${spec.positionTier}-${spec.positionOrder}`,
      );
      if (!position) {
        missingPositions.push(
          `tier=${spec.positionTier} order=${spec.positionOrder} (for "${spec.fullName}")`,
        );
        continue;
      }
      const photoUrl = normalisePhotoUrl(spec.photoUrl);
      const bio = `${TEST_BIO_PREFIX} Auto-loaded fixture for ${position.name} (tier ${spec.positionTier}, order ${spec.positionOrder}).`;
      const existing =
        existingTestByMatric.get(spec.matric) ??
        existingTestByName.get(spec.fullName);
      if (existing) {
        const patch: Partial<Doc<"candidates">> = {};
        if (existing.fullName !== spec.fullName) patch.fullName = spec.fullName;
        if (existing.matric !== spec.matric) patch.matric = spec.matric;
        if (existing.photoUrl !== photoUrl) patch.photoUrl = photoUrl;
        if (existing.bio !== bio) patch.bio = bio;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
          updated += 1;
        } else {
          skipped += 1;
        }

        const existingLink = await ctx.db
          .query("candidatePositions")
          .withIndex("by_position_candidate", (q) =>
            q.eq("positionId", position._id).eq("candidateId", existing._id),
          )
          .first();
        if (!existingLink) {
          await ctx.db.insert("candidatePositions", {
            candidateId: existing._id,
            positionId: position._id,
            fallbackOrder: 0,
          });
          updated += 1;
        }
        continue;
      }

      const candidateId = await ctx.db.insert("candidates", {
        electionId: args.electionId,
        fullName: spec.fullName,
        matric: spec.matric,
        photoUrl,
        bio,
        createdAt: Date.now(),
      });
      await ctx.db.insert("candidatePositions", {
        candidateId,
        positionId: position._id,
        fallbackOrder: 0,
      });
      inserted += 1;
    }

    if (missingPositions.length > 0) {
      throw new ConvexError(
        `Some positions were not found in the current cycle. Run "Seed defaults" on /admin/positions first, then re-run this. Missing: ${missingPositions.join(", ")}`,
      );
    }

    await audit(ctx, {
      actor,
      action: "dev.loadTestCandidates",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        inserted,
        skipped,
        updated,
        totalSpec: TEST_CANDIDATES.length,
      },
    });

    return {
      inserted,
      skipped,
      updated,
      totalSpec: TEST_CANDIDATES.length,
    };
  },
});

export const wipeTestCandidates = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase === "published") {
      throw new ConvexError(
        "Cannot wipe candidates from a published cycle. Create a new cycle first.",
      );
    }

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const testCandidates = candidates.filter((c) => isTestBio(c.bio));

    let candidatesDeleted = 0;
    let linksDeleted = 0;

    for (const c of testCandidates) {
      const links = await ctx.db
        .query("candidatePositions")
        .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
        linksDeleted += 1;
      }
      await ctx.db.delete(c._id);
      candidatesDeleted += 1;
    }

    await audit(ctx, {
      actor,
      action: "dev.wipeTestCandidates",
      entityType: "elections",
      entityId: args.electionId,
      payload: { candidatesDeleted, linksDeleted },
    });

    return { candidatesDeleted, linksDeleted };
  },
});

/**
 * One-shot teardown for an entire test cycle. Combines
 * `wipeSeedData` (synthetic voters + their evaluations + their public
 * votes + result rows + position session resets) and
 * `wipeTestCandidates` (the [TEST_FIXTURE] candidate slate plus
 * candidatePositions links). Real voters, real whitelist rows, real
 * candidates, and the cycle/position/rubric configuration itself are
 * all preserved. The cycle phase is unchanged.
 */
export const wipeAll = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args): Promise<{
    seed: {
      votersDeleted: number;
      whitelistDeleted: number;
      evaluationsDeleted: number;
      scoresDeleted: number;
      votesDeleted: number;
      resultsCleared: number;
      positionsReset: number;
    };
    candidates: {
      candidatesDeleted: number;
      linksDeleted: number;
    };
  }> => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase === "published") {
      throw new ConvexError(
        "Cannot wipe a published cycle. Create a new cycle to start over.",
      );
    }

    const seedVoters = await listSeedVotersForElection(ctx, args.electionId);
    const seedVoterIds = new Set<Id<"voters">>(seedVoters.map((sv) => sv._id));

    let votesDeleted = 0;
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const p of positions) {
      const votes = await ctx.db
        .query("publicVotes")
        .withIndex("by_position", (q) => q.eq("positionId", p._id))
        .collect();
      for (const vote of votes) {
        if (seedVoterIds.has(vote.voterVoterId)) {
          await ctx.db.delete(vote._id);
          votesDeleted += 1;
        }
      }
    }

    let scoresDeleted = 0;
    let evaluationsDeleted = 0;
    const evals = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const e of evals) {
      if (!seedVoterIds.has(e.evaluatorVoterId)) continue;
      const scores = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", e._id))
        .collect();
      for (const s of scores) {
        await ctx.db.delete(s._id);
        scoresDeleted += 1;
      }
      await ctx.db.delete(e._id);
      evaluationsDeleted += 1;
    }

    let whitelistDeleted = 0;
    const whitelist = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const w of whitelist) {
      if (!isSeedEmail(w.email)) continue;
      await ctx.db.delete(w._id);
      whitelistDeleted += 1;
    }

    let votersDeleted = 0;
    for (const v2 of seedVoters) {
      await ctx.db.delete(v2._id);
      votersDeleted += 1;
    }

    let resultsCleared = 0;
    const results = await ctx.db
      .query("results")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    for (const r of results) {
      await ctx.db.delete(r._id);
      resultsCleared += 1;
    }

    let positionsReset = 0;
    for (const p of positions) {
      if (p.sessionStatus !== "pending") {
        await ctx.db.patch(p._id, {
          sessionStatus: "pending",
          sessionStartedAt: undefined,
          sessionClosedAt: undefined,
        });
        positionsReset += 1;
      }
    }

    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const testCandidates = candidates.filter((c) => isTestBio(c.bio));
    let candidatesDeleted = 0;
    let candidateLinksDeleted = 0;
    for (const c of testCandidates) {
      const links = await ctx.db
        .query("candidatePositions")
        .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
        candidateLinksDeleted += 1;
      }
      await ctx.db.delete(c._id);
      candidatesDeleted += 1;
    }

    await audit(ctx, {
      actor,
      action: "dev.wipeAll",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        votersDeleted,
        whitelistDeleted,
        evaluationsDeleted,
        scoresDeleted,
        votesDeleted,
        resultsCleared,
        positionsReset,
        candidatesDeleted,
        candidateLinksDeleted,
      },
    });

    return {
      seed: {
        votersDeleted,
        whitelistDeleted,
        evaluationsDeleted,
        scoresDeleted,
        votesDeleted,
        resultsCleared,
        positionsReset,
      },
      candidates: {
        candidatesDeleted,
        linksDeleted: candidateLinksDeleted,
      },
    };
  },
});

// ---------- scenario: happy path ----------

export const runHappyPathScenario = mutation({
  args: {
    electionId: v.id("elections"),
    perClass: PER_CLASS_VALIDATOR,
    externalVoters: v.number(),
    distribution: DISTRIBUTION_VALIDATOR,
  },
  handler: async (ctx, args): Promise<{
    votersInserted: number;
    evaluationsSubmitted: number;
    externalInserted: number;
    distribution: Distribution;
  }> => {
    requireSeedEnabled();
    const { voter: actor } = await requireAdmin(ctx);
    const election = await getElectionOrThrow(ctx, args.electionId);
    if (election.phase !== "setup" && election.phase !== "internalOpen") {
      throw new ConvexError(
        "Happy path scenario must be run during Setup or Internal Open phase.",
      );
    }

    const counts: PerClassCounts = {
      topCommittee: Math.max(1, Math.floor(args.perClass.topCommittee)),
      headExecutive: Math.max(1, Math.floor(args.perClass.headExecutive)),
      year2Committee: Math.max(1, Math.floor(args.perClass.year2Committee)),
    };
    const externalCount = Math.max(1, Math.floor(args.externalVoters));

    let votersInserted = 0;
    let externalInserted = 0;

    for (const cls of VOTER_CLASSES) {
      const target = counts[cls];
      const short = CLASS_SHORT[cls];
      for (let i = 1; i <= target; i++) {
        const email = seedEmail(args.electionId, short, i);
        const existing = await findExistingSeedVoter(ctx, email);
        if (!existing) {
          await ensureSeedVoter(
            ctx,
            email,
            `Seed ${cls} ${String(i).padStart(2, "0")}`,
            `SEED${short.toUpperCase()}${String(i).padStart(3, "0")}`,
          );
          votersInserted += 1;
        }
        const wl = await ctx.db
          .query("internalWhitelist")
          .withIndex("by_election_email", (q) =>
            q.eq("electionId", args.electionId).eq("email", email),
          )
          .unique();
        if (!wl) {
          await ctx.db.insert("internalWhitelist", {
            electionId: args.electionId,
            email,
            voterClass: cls,
            addedByVoterId: actor._id,
            addedAt: Date.now(),
          });
        } else if (wl.voterClass !== cls) {
          await ctx.db.patch(wl._id, { voterClass: cls });
        }
      }
    }

    for (let i = 1; i <= externalCount; i++) {
      const email = seedEmail(args.electionId, "ext", i);
      const existing = await findExistingSeedVoter(ctx, email);
      if (!existing) {
        await ensureSeedVoter(
          ctx,
          email,
          `Seed external ${String(i).padStart(3, "0")}`,
          `SEEDEXT${String(i).padStart(3, "0")}`,
        );
        externalInserted += 1;
      }
    }

    const candidates = await getCandidatesForElection(ctx, args.electionId);
    if (candidates.length === 0) {
      throw new ConvexError(
        "Add candidates before running the happy path scenario.",
      );
    }
    const criteria = await getCriteriaForElection(ctx, args.electionId);
    if (criteria.length === 0) {
      throw new ConvexError("Configure rubric criteria before running this.");
    }
    const sortedCandidates = candidates
      .slice()
      .sort((a, b) => a._id.localeCompare(b._id));

    const seedWhitelist = await listSeedWhitelistForElection(
      ctx,
      args.electionId,
    );

    let evaluationsSubmitted = 0;
    for (const w of seedWhitelist) {
      const evaluator = await findExistingSeedVoter(ctx, w.email);
      if (!evaluator) continue;
      let evaluation = await ctx.db
        .query("internalEvaluations")
        .withIndex("by_election_evaluator", (q) =>
          q
            .eq("electionId", args.electionId)
            .eq("evaluatorVoterId", evaluator._id),
        )
        .unique();
      if (!evaluation) {
        const id = await ctx.db.insert("internalEvaluations", {
          electionId: args.electionId,
          evaluatorVoterId: evaluator._id,
          status: "submitted",
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        });
        const created = await ctx.db.get(id);
        if (!created) continue;
        evaluation = created;
      } else {
        await ctx.db.patch(evaluation._id, {
          status: "submitted",
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const seed = hashStringToInt(`${args.distribution}|${evaluator._id}`);
      const rand = mulberry32(seed);

      for (let i = 0; i < sortedCandidates.length; i++) {
        const candidate = sortedCandidates[i];
        if (!candidate) continue;
        for (const crit of criteria) {
          const score = computeScoreForCriterion(
            rand,
            args.distribution,
            i,
            sortedCandidates.length,
            crit.maxScore,
          );
          const existing = (
            await ctx.db
              .query("internalScores")
              .withIndex("by_evaluation_candidate", (q) =>
                q
                  .eq("evaluationId", evaluation._id)
                  .eq("candidateId", candidate._id),
              )
              .collect()
          ).find((row) => row.criterionId === crit._id);
          const payload = {
            evaluationId: evaluation._id,
            candidateId: candidate._id,
            criterionId: crit._id,
            score,
          };
          if (existing) {
            await ctx.db.patch(existing._id, payload);
          } else {
            await ctx.db.insert("internalScores", payload);
          }
        }
      }
      evaluationsSubmitted += 1;
    }

    await audit(ctx, {
      actor,
      action: "dev.runHappyPathScenario",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        topCommittee: counts.topCommittee,
        headExecutive: counts.headExecutive,
        year2Committee: counts.year2Committee,
        externalVoters: externalCount,
        distribution: args.distribution,
        votersInserted,
        externalInserted,
        evaluationsSubmitted,
      },
    });

    return {
      votersInserted,
      evaluationsSubmitted,
      externalInserted,
      distribution: args.distribution,
    };
  },
});
