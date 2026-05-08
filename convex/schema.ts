import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  voters: defineTable({
    tokenIdentifier: v.string(),
    email: v.string(),
    firebaseUid: v.string(),

    fullName: v.optional(v.string()),
    matric: v.optional(v.string()),
    yearOfStudy: v.optional(v.number()),
    profileComplete: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_firebase_uid", ["firebaseUid"]),

  admins: defineTable({
    voterId: v.optional(v.id("voters")),
    email: v.string(),
    role: v.union(v.literal("super"), v.literal("admin")),
    createdByAdminId: v.optional(v.id("admins")),
    createdAt: v.number(),
  })
    .index("by_voter", ["voterId"])
    .index("by_email", ["email"]),

  auditLog: defineTable({
    actorVoterId: v.optional(v.id("voters")),
    actorEmail: v.optional(v.string()),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    payload: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null())),
    ),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  elections: defineTable({
    name: v.string(),
    year: v.number(),
    phase: v.union(
      v.literal("setup"),
      v.literal("internalOpen"),
      v.literal("internalClosed"),
      v.literal("publicVoting"),
      v.literal("resultsPreview"),
      v.literal("published"),
    ),
    createdByVoterId: v.id("voters"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_phase", ["phase"])
    .index("by_year", ["year"]),

  positions: defineTable({
    electionId: v.id("elections"),
    name: v.string(),
    tier: v.number(),
    order: v.number(),
    sessionStatus: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("closed"),
    ),
    sessionStartedAt: v.optional(v.number()),
    sessionClosedAt: v.optional(v.number()),
  })
    .index("by_election", ["electionId"])
    .index("by_election_tier_order", ["electionId", "tier", "order"])
    .index("by_election_session", ["electionId", "sessionStatus"]),

  candidates: defineTable({
    electionId: v.id("elections"),
    fullName: v.string(),
    matric: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_election", ["electionId"]),

  candidatePositions: defineTable({
    candidateId: v.id("candidates"),
    positionId: v.id("positions"),
    fallbackOrder: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_position", ["positionId"])
    .index("by_position_candidate", ["positionId", "candidateId"]),

  internalWhitelist: defineTable({
    electionId: v.id("elections"),
    email: v.string(),
    addedByVoterId: v.id("voters"),
    addedAt: v.number(),
  })
    .index("by_election", ["electionId"])
    .index("by_election_email", ["electionId", "email"]),

  internalEvaluations: defineTable({
    electionId: v.id("elections"),
    evaluatorVoterId: v.id("voters"),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    submittedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_election", ["electionId"])
    .index("by_election_evaluator", ["electionId", "evaluatorVoterId"]),

  internalScores: defineTable({
    evaluationId: v.id("internalEvaluations"),
    candidateId: v.id("candidates"),
    leadership: v.number(),
    teamwork: v.number(),
    professionalism: v.number(),
    commitment: v.number(),
    personality: v.number(),
  })
    .index("by_evaluation", ["evaluationId"])
    .index("by_evaluation_candidate", ["evaluationId", "candidateId"])
    .index("by_candidate", ["candidateId"]),

  publicVotes: defineTable({
    electionId: v.id("elections"),
    positionId: v.id("positions"),
    voterVoterId: v.id("voters"),
    candidateId: v.id("candidates"),
    votedAt: v.number(),
  })
    .index("by_position", ["positionId"])
    .index("by_position_voter", ["positionId", "voterVoterId"])
    .index("by_position_candidate", ["positionId", "candidateId"]),

  results: defineTable({
    electionId: v.id("elections"),
    positionId: v.id("positions"),
    state: v.union(
      v.literal("previewed"),
      v.literal("published"),
      v.literal("manualTieResolved"),
    ),
    winnerCandidateId: v.optional(v.id("candidates")),
    breakdown: v.array(
      v.object({
        candidateId: v.id("candidates"),
        internalAvg: v.number(),
        internalShare: v.number(),
        publicVotes: v.number(),
        publicShare: v.number(),
        finalScore: v.number(),
      }),
    ),
    manualResolutionReason: v.optional(v.string()),
    resolvedByVoterId: v.optional(v.id("voters")),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_election", ["electionId"])
    .index("by_election_position", ["electionId", "positionId"]),
});
