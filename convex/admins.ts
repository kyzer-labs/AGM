import { v } from "convex/values";
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
        const voter = await ctx.db.get(a.voterId);
        return {
          _id: a._id,
          email: a.email,
          role: a.role,
          fullName: voter?.fullName ?? null,
          createdAt: a.createdAt,
        };
      }),
    );
    return enriched.sort((a, b) =>
      a.role === b.role ? a.email.localeCompare(b.email) : a.role === "super" ? -1 : 1,
    );
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
      throw new Error(
        "SUPER_ADMIN_BOOTSTRAP_TOKEN is not configured on the Convex deployment.",
      );
    }
    if (args.token !== expected) {
      throw new Error("Invalid bootstrap token.");
    }

    const existingSuper = await ctx.db
      .query("admins")
      .filter((q) => q.eq(q.field("role"), "super"))
      .first();
    if (existingSuper) {
      throw new Error(
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

export const grantAdmin = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("super"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const { admin: actorAdmin, voter: actor } = await requireSuperAdmin(ctx);

    const targetEmail = args.email.trim().toLowerCase();
    if (!targetEmail.endsWith("@student.usm.my")) {
      throw new Error("Admin email must be a @student.usm.my address.");
    }

    const targetVoter = await ctx.db
      .query("voters")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .unique();

    if (!targetVoter) {
      throw new Error(
        "That user has not signed in yet. Ask them to sign in once first.",
      );
    }

    const existing = await getAdminForVoter(ctx, targetVoter._id);
    if (existing) {
      if (existing.role === args.role) return existing._id;
      await ctx.db.patch(existing._id, { role: args.role });
      await audit(ctx, {
        actor,
        action: "admin.roleChanged",
        entityType: "admins",
        entityId: existing._id,
        payload: { newRole: args.role },
      });
      return existing._id;
    }

    const adminId = await ctx.db.insert("admins", {
      voterId: targetVoter._id,
      email: targetEmail,
      role: args.role,
      createdByAdminId: actorAdmin._id,
      createdAt: Date.now(),
    });

    await audit(ctx, {
      actor,
      action: "admin.granted",
      entityType: "admins",
      entityId: adminId,
      payload: { role: args.role, targetEmail },
    });

    return adminId;
  },
});

export const revokeAdmin = mutation({
  args: { adminId: v.id("admins") },
  handler: async (ctx, args) => {
    const { voter: actor, admin: actorAdmin } = await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.adminId);
    if (!target) throw new Error("Admin not found.");
    if (target._id === actorAdmin._id) {
      throw new Error("You cannot revoke your own admin access here.");
    }
    if (target.role === "super") {
      const supers = await ctx.db
        .query("admins")
        .filter((q) => q.eq(q.field("role"), "super"))
        .collect();
      if (supers.length <= 1) {
        throw new Error("Cannot revoke the only remaining super admin.");
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
