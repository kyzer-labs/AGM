import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getAdminForVoter,
  requireAdmin,
  requireCompletedProfile,
  requireSuperAdmin,
} from "./lib/auth";
import { audit } from "./lib/audit";

export const myAdminStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const voter = await ctx.db
      .query("voters")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!voter) return null;
    const admin = await getAdminForVoter(ctx, voter._id);
    if (!admin) return null;
    return { role: admin.role };
  },
});

/**
 * Public-ish: returns whether *any* super admin exists.
 * Used by the admin landing page to decide between showing the
 * one-time bootstrap form or redirecting non-admins away.
 */
export const superAdminExists = query({
  args: {},
  handler: async (ctx) => {
    const someSuper = await ctx.db
      .query("admins")
      .filter((q) => q.eq(q.field("role"), "super"))
      .first();
    return someSuper !== null;
  },
});

export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const admins = await ctx.db.query("admins").collect();
    const enriched = await Promise.all(
      admins.map(async (a) => {
        const voter = a.voterId ? await ctx.db.get(a.voterId) : null;
        return {
          _id: a._id,
          email: a.email,
          role: a.role,
          fullName: voter?.fullName ?? null,
          pending: a.voterId === undefined,
          createdAt: a.createdAt,
        };
      }),
    );
    return enriched.sort((a, b) => {
      if (a.role !== b.role) return a.role === "super" ? -1 : 1;
      if (a.pending !== b.pending) return a.pending ? 1 : -1;
      return a.email.localeCompare(b.email);
    });
  },
});

/**
 * One-time bootstrap of the very first super admin.
 *
 * The caller must already be a signed-in @student.usm.my user with a
 * completed profile. They must also pass the SUPER_ADMIN_BOOTSTRAP_TOKEN
 * configured in the Convex deployment env. Once any super admin exists,
 * this mutation refuses to do anything.
 */
export const bootstrapSuperAdmin = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
    if (!expected || expected.length < 16) {
      throw new ConvexError(
        "SUPER_ADMIN_BOOTSTRAP_TOKEN is not configured on the Convex deployment.",
      );
    }
    if (args.token !== expected) {
      throw new ConvexError("Invalid bootstrap token.");
    }

    const existingSuper = await ctx.db
      .query("admins")
      .filter((q) => q.eq(q.field("role"), "super"))
      .first();
    if (existingSuper) {
      throw new ConvexError(
        "A super admin already exists. Bootstrap is no longer available.",
      );
    }

    const voter = await requireCompletedProfile(ctx);

    const adminId = await ctx.db.insert("admins", {
      voterId: voter._id,
      email: voter.email,
      role: "super",
      createdAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "admin.bootstrapSuperAdmin",
      entityType: "admins",
      entityId: adminId,
    });

    return adminId;
  },
});

/**
 * Grant admin access to a `@student.usm.my` email.
 *
 * Two cases:
 *   - Target voter already exists (they have signed in at least once):
 *     the new admin row is linked to that voter immediately.
 *   - Target voter does not exist yet: the admin row is created as a
 *     "pending invite" with `voterId` left undefined. The grant lies
 *     dormant until that user signs in for the first time, at which
 *     point `voters.ensureVoter` automatically attaches the voterId.
 *
 * Pending invites cannot actually do anything (they have no voterId,
 * so `getAdminForVoter` won't find them); they only become active on
 * first sign-in.
 */
export const grantAdmin = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("super"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const { admin: actorAdmin, voter: actor } = await requireSuperAdmin(ctx);

    const targetEmail = args.email.trim().toLowerCase();
    if (!targetEmail.endsWith("@student.usm.my")) {
      throw new ConvexError("Admin email must be a @student.usm.my address.");
    }

    const targetVoter = await ctx.db
      .query("voters")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .unique();

    const existingByEmail = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .unique();

    if (existingByEmail) {
      const patch: {
        role?: "super" | "admin";
        voterId?: typeof existingByEmail.voterId;
      } = {};
      if (existingByEmail.role !== args.role) patch.role = args.role;
      if (existingByEmail.voterId === undefined && targetVoter) {
        patch.voterId = targetVoter._id;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingByEmail._id, patch);
        await audit(ctx, {
          actor,
          action: "admin.roleChanged",
          entityType: "admins",
          entityId: existingByEmail._id,
          payload: {
            newRole: args.role,
            linkedVoter: patch.voterId !== undefined,
          },
        });
      }
      const stillPending =
        existingByEmail.voterId === undefined && targetVoter === null;
      return { adminId: existingByEmail._id, pending: stillPending };
    }

    const adminId = await ctx.db.insert("admins", {
      voterId: targetVoter?._id,
      email: targetEmail,
      role: args.role,
      createdByAdminId: actorAdmin._id,
      createdAt: Date.now(),
    });

    const pending = targetVoter === null;

    await audit(ctx, {
      actor,
      action: "admin.granted",
      entityType: "admins",
      entityId: adminId,
      payload: {
        role: args.role,
        targetEmail,
        pending,
      },
    });

    return { adminId, pending };
  },
});

export const revokeAdmin = mutation({
  args: { adminId: v.id("admins") },
  handler: async (ctx, args) => {
    const { voter: actor, admin: actorAdmin } = await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.adminId);
    if (!target) throw new ConvexError("Admin not found.");
    if (target._id === actorAdmin._id) {
      throw new ConvexError("You cannot revoke your own admin access here.");
    }
    if (target.role === "super") {
      const supers = await ctx.db
        .query("admins")
        .filter((q) => q.eq(q.field("role"), "super"))
        .collect();
      if (supers.length <= 1) {
        throw new ConvexError("Cannot revoke the only remaining super admin.");
      }
    }

    await ctx.db.delete(target._id);
    await audit(ctx, {
      actor,
      action: "admin.revoked",
      entityType: "admins",
      entityId: target._id,
      payload: { revokedEmail: target.email, revokedRole: target.role },
    });
  },
});
