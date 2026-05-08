import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const USM_DOMAIN = "@student.usm.my";

export interface AuthIdentitySafe {
  tokenIdentifier: string;
  subject: string;
  email: string;
  firebaseUid: string;
  name: string | null;
}

function isUsm(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(USM_DOMAIN);
}

export async function getIdentitySafeOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthIdentitySafe | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const email = identity.email ?? null;
  if (!isUsm(email)) return null;
  return {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    email: (email ?? "").toLowerCase(),
    firebaseUid: identity.subject,
    name: identity.name ?? null,
  };
}

export async function requireIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthIdentitySafe> {
  const id = await getIdentitySafeOrNull(ctx);
  if (!id) {
    throw new ConvexError(
      "Not signed in with a valid @student.usm.my account.",
    );
  }
  return id;
}

export async function getCurrentVoterOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"voters"> | null> {
  const id = await getIdentitySafeOrNull(ctx);
  if (!id) return null;
  return await ctx.db
    .query("voters")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", id.tokenIdentifier))
    .unique();
}

export async function requireVoter(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"voters">> {
  const voter = await getCurrentVoterOrNull(ctx);
  if (!voter) {
    throw new ConvexError(
      "Voter record not found. Sign in once so the system can create your profile.",
    );
  }
  return voter;
}

export async function requireCompletedProfile(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"voters">> {
  const voter = await requireVoter(ctx);
  if (!voter.profileComplete) {
    throw new ConvexError(
      "Please complete your voter profile before continuing.",
    );
  }
  return voter;
}

export async function getAdminForVoter(
  ctx: QueryCtx | MutationCtx,
  voterId: Doc<"voters">["_id"],
): Promise<Doc<"admins"> | null> {
  return await ctx.db
    .query("admins")
    .withIndex("by_voter", (q) => q.eq("voterId", voterId))
    .unique();
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<{ voter: Doc<"voters">; admin: Doc<"admins"> }> {
  const voter = await requireCompletedProfile(ctx);
  const admin = await getAdminForVoter(ctx, voter._id);
  if (!admin) {
    throw new ConvexError("Admin access required.");
  }
  return { voter, admin };
}

export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<{ voter: Doc<"voters">; admin: Doc<"admins"> }> {
  const result = await requireAdmin(ctx);
  if (result.admin.role !== "super") {
    throw new ConvexError("Super admin access required.");
  }
  return result;
}

export async function isInInternalWhitelist(
  ctx: QueryCtx | MutationCtx,
  electionId: Doc<"elections">["_id"],
  email: string,
): Promise<boolean> {
  const entry = await ctx.db
    .query("internalWhitelist")
    .withIndex("by_election_email", (q) =>
      q.eq("electionId", electionId).eq("email", email.toLowerCase()),
    )
    .unique();
  return entry !== null;
}
