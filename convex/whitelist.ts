import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";

const USM_DOMAIN = "@student.usm.my";

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function validUsmEmail(email: string): boolean {
  return email.endsWith(USM_DOMAIN) && email.length > USM_DOMAIN.length;
}

export const list = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await getElectionOrThrow(ctx, args.electionId);

    const rows = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    return rows
      .map((r) => ({
        _id: r._id,
        email: r.email,
        addedAt: r.addedAt,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});

export const add = mutation({
  args: {
    electionId: v.id("elections"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new Error(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    const email = normalizeEmail(args.email);
    if (!validUsmEmail(email)) {
      throw new Error("Whitelist emails must be @student.usm.my addresses.");
    }

    const existing = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election_email", (q) =>
        q.eq("electionId", args.electionId).eq("email", email),
      )
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert("internalWhitelist", {
      electionId: args.electionId,
      email,
      addedByVoterId: voter._id,
      addedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "whitelist.added",
      entityType: "internalWhitelist",
      entityId: id,
      payload: { email },
    });

    return id;
  },
});

export const remove = mutation({
  args: { entryId: v.id("internalWhitelist") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const row = await ctx.db.get(args.entryId);
    if (!row) throw new Error("Whitelist entry not found.");
    const e = await getElectionOrThrow(ctx, row.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new Error(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    await ctx.db.delete(row._id);
    await audit(ctx, {
      actor: voter,
      action: "whitelist.removed",
      entityType: "internalWhitelist",
      entityId: row._id,
      payload: { email: row.email },
    });
  },
});

interface BulkSummary {
  inserted: number;
  skipped: number;
  invalid: string[];
}

export const bulkAdd = mutation({
  args: {
    electionId: v.id("elections"),
    emails: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<BulkSummary> => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new Error(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    const summary: BulkSummary = { inserted: 0, skipped: 0, invalid: [] };
    const seen = new Set<string>();

    for (const raw of args.emails) {
      const email = normalizeEmail(raw);
      if (email.length === 0) continue;
      if (seen.has(email)) continue;
      seen.add(email);

      if (!validUsmEmail(email)) {
        summary.invalid.push(email);
        continue;
      }

      const existing = await ctx.db
        .query("internalWhitelist")
        .withIndex("by_election_email", (q) =>
          q.eq("electionId", args.electionId).eq("email", email),
        )
        .unique();
      if (existing) {
        summary.skipped += 1;
        continue;
      }

      await ctx.db.insert("internalWhitelist", {
        electionId: args.electionId,
        email,
        addedByVoterId: voter._id,
        addedAt: Date.now(),
      });
      summary.inserted += 1;
    }

    await audit(ctx, {
      actor: voter,
      action: "whitelist.bulkAdded",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        inserted: summary.inserted,
        skipped: summary.skipped,
        invalid: summary.invalid.length,
      },
    });

    return summary;
  },
});
