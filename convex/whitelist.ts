import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow } from "./lib/setup";
import { getEntryClass, type VoterClass } from "./lib/cycle";

const USM_DOMAIN = "@student.usm.my";

const VOTER_CLASS_VALIDATOR = v.union(
  v.literal("topCommittee"),
  v.literal("headExecutive"),
  v.literal("year2Committee"),
);

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function validUsmEmail(email: string): boolean {
  return email.endsWith(USM_DOMAIN) && email.length > USM_DOMAIN.length;
}

const VOTER_CLASS_ALIASES: Record<string, VoterClass> = {
  topcommittee: "topCommittee",
  top: "topCommittee",
  topcomm: "topCommittee",
  president: "topCommittee",
  vp: "topCommittee",
  headexecutive: "headExecutive",
  head: "headExecutive",
  director: "headExecutive",
  exec: "headExecutive",
  he: "headExecutive",
  year2: "year2Committee",
  year2committee: "year2Committee",
  coordinator: "year2Committee",
  y2: "year2Committee",
  yr2: "year2Committee",
};

function parseVoterClass(input: string | undefined | null): VoterClass | null {
  if (!input) return null;
  const key = input.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return VOTER_CLASS_ALIASES[key] ?? null;
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
        voterClass: getEntryClass(r),
        addedAt: r.addedAt,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});

export const add = mutation({
  args: {
    electionId: v.id("elections"),
    email: v.string(),
    voterClass: VOTER_CLASS_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new ConvexError(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    const email = normalizeEmail(args.email);
    if (!validUsmEmail(email)) {
      throw new ConvexError("Whitelist emails must be @student.usm.my addresses.");
    }

    const existing = await ctx.db
      .query("internalWhitelist")
      .withIndex("by_election_email", (q) =>
        q.eq("electionId", args.electionId).eq("email", email),
      )
      .unique();
    if (existing) {
      if (existing.voterClass !== args.voterClass) {
        await ctx.db.patch(existing._id, { voterClass: args.voterClass });
        await audit(ctx, {
          actor: voter,
          action: "whitelist.classChanged",
          entityType: "internalWhitelist",
          entityId: existing._id,
          payload: {
            email,
            from: existing.voterClass ?? "year2Committee",
            to: args.voterClass,
          },
        });
      }
      return existing._id;
    }

    const id = await ctx.db.insert("internalWhitelist", {
      electionId: args.electionId,
      email,
      voterClass: args.voterClass,
      addedByVoterId: voter._id,
      addedAt: Date.now(),
    });

    await audit(ctx, {
      actor: voter,
      action: "whitelist.added",
      entityType: "internalWhitelist",
      entityId: id,
      payload: { email, voterClass: args.voterClass },
    });

    return id;
  },
});

export const setClass = mutation({
  args: {
    entryId: v.id("internalWhitelist"),
    voterClass: VOTER_CLASS_VALIDATOR,
  },
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

    const previous = row.voterClass ?? "year2Committee";
    if (previous === args.voterClass) return;

    await ctx.db.patch(row._id, { voterClass: args.voterClass });
    await audit(ctx, {
      actor: voter,
      action: "whitelist.classChanged",
      entityType: "internalWhitelist",
      entityId: row._id,
      payload: { email: row.email, from: previous, to: args.voterClass },
    });
  },
});

export const remove = mutation({
  args: { entryId: v.id("internalWhitelist") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const row = await ctx.db.get(args.entryId);
    if (!row) throw new ConvexError("Whitelist entry not found.");
    const e = await getElectionOrThrow(ctx, row.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new ConvexError(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    await ctx.db.delete(row._id);
    await audit(ctx, {
      actor: voter,
      action: "whitelist.removed",
      entityType: "internalWhitelist",
      entityId: row._id,
      payload: {
        email: row.email,
        voterClass: row.voterClass ?? "year2Committee",
      },
    });
  },
});

interface BulkSummary {
  inserted: number;
  skipped: number;
  invalid: string[];
  reclassified: number;
}

export const bulkAdd = mutation({
  args: {
    electionId: v.id("elections"),
    rows: v.array(
      v.object({
        email: v.string(),
        voterClass: v.optional(v.string()),
      }),
    ),
    defaultClass: VOTER_CLASS_VALIDATOR,
  },
  handler: async (ctx, args): Promise<BulkSummary> => {
    const { voter } = await requireAdmin(ctx);
    const e = await getElectionOrThrow(ctx, args.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new ConvexError(
        "Whitelist can only be edited during Setup or Internal Open phases.",
      );
    }

    const summary: BulkSummary = {
      inserted: 0,
      skipped: 0,
      invalid: [],
      reclassified: 0,
    };
    const seen = new Set<string>();

    for (const raw of args.rows) {
      const email = normalizeEmail(raw.email);
      if (email.length === 0) continue;
      if (seen.has(email)) continue;
      seen.add(email);

      if (!validUsmEmail(email)) {
        summary.invalid.push(email);
        continue;
      }

      const explicitClass = parseVoterClass(raw.voterClass);
      const cls = explicitClass ?? args.defaultClass;

      const existing = await ctx.db
        .query("internalWhitelist")
        .withIndex("by_election_email", (q) =>
          q.eq("electionId", args.electionId).eq("email", email),
        )
        .unique();
      if (existing) {
        if (existing.voterClass !== cls) {
          await ctx.db.patch(existing._id, { voterClass: cls });
          summary.reclassified += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      await ctx.db.insert("internalWhitelist", {
        electionId: args.electionId,
        email,
        voterClass: cls,
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
        reclassified: summary.reclassified,
        invalid: summary.invalid.length,
      },
    });

    return summary;
  },
});
