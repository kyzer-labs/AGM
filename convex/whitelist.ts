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
    if (!row) throw new ConvexError("Whitelist entry not found.");
    const e = await getElectionOrThrow(ctx, row.electionId);
    if (e.phase !== "setup" && e.phase !== "internalOpen") {
      throw new ConvexError(
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

interface BulkIssue {
  displayRow: string;
  email: string;
  reason: string;
}

interface BulkSummary {
  inserted: number;
  skipped: number;
  reclassified: number;
  /** Rows that did not import (invalid email, empty, etc.). */
  errors: BulkIssue[];
  /**
   * Rows that imported with a fallback (e.g. unrecognized voterClass
   * silently coerced to the default, or a duplicate within the same
   * input list whose later occurrence was ignored). The row was either
   * inserted or already existed; this is informational.
   */
  warnings: BulkIssue[];
}

export const bulkAdd = mutation({
  args: {
    electionId: v.id("elections"),
    rows: v.array(
      v.object({
        /**
         * Caller-supplied label for error reporting (e.g. "Row 14" for
         * CSV with a header line, "Line 5" for paste). The server passes
         * it through to errors/warnings unchanged so the user sees the
         * label that matches their source file.
         */
        displayRow: v.string(),
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
      reclassified: 0,
      errors: [],
      warnings: [],
    };
    const seen = new Set<string>();

    for (const raw of args.rows) {
      const displayRow = raw.displayRow;
      const email = normalizeEmail(raw.email);
      if (email.length === 0) {
        summary.errors.push({
          displayRow,
          email: "(empty)",
          reason: "Email is empty.",
        });
        continue;
      }
      if (seen.has(email)) {
        summary.warnings.push({
          displayRow,
          email,
          reason:
            "Email appeared earlier in this import; later occurrence ignored.",
        });
        continue;
      }
      seen.add(email);

      if (!validUsmEmail(email)) {
        summary.errors.push({
          displayRow,
          email,
          reason: `Email must end in ${USM_DOMAIN}.`,
        });
        continue;
      }

      let cls = args.defaultClass;
      if (raw.voterClass && raw.voterClass.trim().length > 0) {
        const explicit = parseVoterClass(raw.voterClass);
        if (explicit === null) {
          summary.warnings.push({
            displayRow,
            email,
            reason: `voterClass "${raw.voterClass}" is not one of topCommittee, headExecutive, or year2Committee. Used default class instead.`,
          });
        } else {
          cls = explicit;
        }
      }

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
        errors: summary.errors.length,
        warnings: summary.warnings.length,
      },
    });

    return summary;
  },
});

/**
 * Per-entry impact for destructive confirm copy. Returns the evaluator's
 * sign-in status, evaluation count, and (when applicable) the MYT
 * timestamp of their most recent submitted evaluation. Lets the admin
 * see exactly what gets dropped if they delete a whitelist entry that
 * has already been used to score candidates.
 */
export const entryImpact = query({
  args: { entryId: v.id("internalWhitelist") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;

    const voterRow = await ctx.db
      .query("voters")
      .withIndex("by_email", (q) => q.eq("email", entry.email))
      .unique();

    if (!voterRow) {
      return {
        email: entry.email,
        hasSignedIn: false,
        evaluationCount: 0,
        submittedCount: 0,
        draftCount: 0,
        scoreCount: 0,
        lastSubmittedAt: null as number | null,
      };
    }

    const evaluations = await ctx.db
      .query("internalEvaluations")
      .withIndex("by_election_evaluator", (q) =>
        q.eq("electionId", entry.electionId).eq("evaluatorVoterId", voterRow._id),
      )
      .collect();

    let submittedCount = 0;
    let draftCount = 0;
    let lastSubmittedAt: number | null = null;
    let scoreCount = 0;
    for (const ev of evaluations) {
      if (ev.status === "submitted") {
        submittedCount += 1;
        const stamp = ev.submittedAt ?? ev._creationTime;
        if (lastSubmittedAt === null || stamp > lastSubmittedAt) {
          lastSubmittedAt = stamp;
        }
      } else {
        draftCount += 1;
      }
      const scores = await ctx.db
        .query("internalScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", ev._id))
        .collect();
      scoreCount += scores.length;
    }

    return {
      email: entry.email,
      hasSignedIn: true,
      evaluationCount: evaluations.length,
      submittedCount,
      draftCount,
      scoreCount,
      lastSubmittedAt,
    };
  },
});
