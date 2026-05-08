import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getAdminForVoter,
  getCurrentVoterOrNull,
  requireCompletedProfile,
  requireIdentity,
  requireVoter,
} from "./lib/auth";
import { audit } from "./lib/audit";

/**
 * Idempotent on every sign-in: ensures a `voters` row exists for the
 * current Firebase identity and returns it. Profile fields are left
 * unset until the user completes the profile form.
 */
export const ensureVoter = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);

    const existing = await ctx.db
      .query("voters")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      const patches: { email?: string; firebaseUid?: string; updatedAt?: number } = {};
      if (existing.email !== identity.email) {
        patches.email = identity.email;
      }
      if (existing.firebaseUid !== identity.firebaseUid) {
        patches.firebaseUid = identity.firebaseUid;
      }
      if (Object.keys(patches).length > 0) {
        patches.updatedAt = Date.now();
        await ctx.db.patch(existing._id, patches);
      }
      return existing._id;
    }

    const voterId = await ctx.db.insert("voters", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      firebaseUid: identity.firebaseUid,
      profileComplete: false,
      createdAt: Date.now(),
    });

    return voterId;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const voter = await getCurrentVoterOrNull(ctx);
    if (!voter) return null;
    const admin = await getAdminForVoter(ctx, voter._id);
    return {
      _id: voter._id,
      email: voter.email,
      fullName: voter.fullName ?? null,
      matric: voter.matric ?? null,
      yearOfStudy: voter.yearOfStudy ?? null,
      profileComplete: voter.profileComplete,
      role: admin?.role ?? null,
    };
  },
});

const trimmed = (s: string) => s.trim();

export const completeProfile = mutation({
  args: {
    fullName: v.string(),
    matric: v.string(),
    yearOfStudy: v.number(),
  },
  handler: async (ctx, args) => {
    const voter = await requireVoter(ctx);

    const fullName = trimmed(args.fullName);
    const matric = trimmed(args.matric);

    if (fullName.length < 2 || fullName.length > 120) {
      throw new Error("Full name must be between 2 and 120 characters.");
    }
    if (matric.length < 6 || matric.length > 20) {
      throw new Error("Matric number must be between 6 and 20 characters.");
    }
    if (
      !Number.isInteger(args.yearOfStudy) ||
      args.yearOfStudy < 1 ||
      args.yearOfStudy > 6
    ) {
      throw new Error("Year of study must be an integer between 1 and 6.");
    }

    await ctx.db.patch(voter._id, {
      fullName,
      matric,
      yearOfStudy: args.yearOfStudy,
      profileComplete: true,
      updatedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "profile.completed",
      entityType: "voters",
      entityId: voter._id,
    });
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    matric: v.optional(v.string()),
    yearOfStudy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const voter = await requireCompletedProfile(ctx);

    const patches: {
      fullName?: string;
      matric?: string;
      yearOfStudy?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.fullName !== undefined) {
      const v2 = trimmed(args.fullName);
      if (v2.length < 2 || v2.length > 120) {
        throw new Error("Full name must be between 2 and 120 characters.");
      }
      patches.fullName = v2;
    }
    if (args.matric !== undefined) {
      const v2 = trimmed(args.matric);
      if (v2.length < 6 || v2.length > 20) {
        throw new Error("Matric number must be between 6 and 20 characters.");
      }
      patches.matric = v2;
    }
    if (args.yearOfStudy !== undefined) {
      if (
        !Number.isInteger(args.yearOfStudy) ||
        args.yearOfStudy < 1 ||
        args.yearOfStudy > 6
      ) {
        throw new Error("Year of study must be an integer between 1 and 6.");
      }
      patches.yearOfStudy = args.yearOfStudy;
    }

    await ctx.db.patch(voter._id, patches);

    await audit(ctx, {
      actor: voter,
      action: "profile.updated",
      entityType: "voters",
      entityId: voter._id,
    });
  },
});
