import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  isInInternalWhitelist,
  requireCompletedProfile,
} from "./lib/auth";
import { audit } from "./lib/audit";
import { getResolvedWinnerCandidateIds } from "./lib/results";

export const myVote = query({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const voter = await requireCompletedProfile(ctx);
    const vote = await ctx.db
      .query("publicVotes")
      .withIndex("by_position_voter", (q) =>
        q.eq("positionId", args.positionId).eq("voterVoterId", voter._id),
      )
      .unique();
    return vote
      ? {
          candidateId: vote.candidateId,
          votedAt: vote.votedAt,
        }
      : null;
  },
});

export const cast = mutation({
  args: {
    positionId: v.id("positions"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    const voter = await requireCompletedProfile(ctx);

    const position = await ctx.db.get(args.positionId);
    if (!position) throw new ConvexError("Ballot not found.");
    const election = await ctx.db.get(position.electionId);
    if (!election) throw new ConvexError("Election not found.");

    if (election.phase !== "publicVoting") {
      throw new ConvexError("Public voting is not currently active.");
    }
    if (position.sessionStatus !== "active") {
      throw new ConvexError("This ballot is not currently open.");
    }

    const onWhitelist = await isInInternalWhitelist(
      ctx,
      election._id,
      voter.email,
    );
    if (onWhitelist) {
      throw new ConvexError(
        "Year 2 internal evaluators do not cast external public votes.",
      );
    }

    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.electionId !== election._id) {
      throw new ConvexError("Candidate is not part of this election.");
    }

    const link = await ctx.db
      .query("candidatePositions")
      .withIndex("by_position_candidate", (q) =>
        q
          .eq("positionId", position._id)
          .eq("candidateId", args.candidateId),
      )
      .unique();
    if (!link) {
      throw new ConvexError("That candidate is not running for this position.");
    }

    const winners = await getResolvedWinnerCandidateIds(ctx, election._id);
    if (winners.has(args.candidateId)) {
      throw new ConvexError(
        "That candidate already won an earlier position and is no longer on this ballot.",
      );
    }

    const existing = await ctx.db
      .query("publicVotes")
      .withIndex("by_position_voter", (q) =>
        q.eq("positionId", position._id).eq("voterVoterId", voter._id),
      )
      .unique();
    if (existing) {
      throw new ConvexError("You have already voted for this position.");
    }

    await ctx.db.insert("publicVotes", {
      electionId: election._id,
      positionId: position._id,
      voterVoterId: voter._id,
      candidateId: args.candidateId,
      votedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "vote.cast",
      entityType: "positions",
      entityId: position._id,
    });
  },
});
