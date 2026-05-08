import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { getElectionOrThrow, requireSetupPhase } from "./lib/setup";
import type { Doc, Id } from "./_generated/dataModel";

export const list = query({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await getElectionOrThrow(ctx, args.electionId);
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();

    const enriched = await Promise.all(
      candidates.map(async (c) => {
        const links = await ctx.db
          .query("candidatePositions")
          .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
          .collect();
        const positions = await Promise.all(
          links
            .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
            .map(async (l) => {
              const p = await ctx.db.get(l.positionId);
              return p
                ? {
                    positionId: p._id,
                    name: p.name,
                    tier: p.tier,
                    fallbackOrder: l.fallbackOrder,
                  }
                : null;
            }),
        );
        const photoUrl = c.photoStorageId
          ? await ctx.storage.getUrl(c.photoStorageId)
          : null;
        return {
          _id: c._id,
          fullName: c.fullName,
          matric: c.matric,
          bio: c.bio ?? null,
          photoStorageId: c.photoStorageId ?? null,
          photoUrl,
          positions: positions.filter(
            (p): p is NonNullable<typeof p> => p !== null,
          ),
        };
      }),
    );

    return enriched.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const add = mutation({
  args: {
    electionId: v.id("elections"),
    fullName: v.string(),
    matric: v.string(),
    bio: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    positionAssignments: v.optional(
      v.array(
        v.object({
          positionId: v.id("positions"),
          fallbackOrder: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);

    const fullName = args.fullName.trim();
    const matric = args.matric.trim();
    if (fullName.length < 2 || fullName.length > 120) {
      throw new ConvexError("Full name must be between 2 and 120 characters.");
    }
    if (matric.length < 6 || matric.length > 20) {
      throw new ConvexError("Matric number must be between 6 and 20 characters.");
    }
    const bio = args.bio?.trim();
    if (bio !== undefined && bio.length > 1000) {
      throw new ConvexError("Bio must be at most 1000 characters.");
    }

    const candidateId = await ctx.db.insert("candidates", {
      electionId: args.electionId,
      fullName,
      matric,
      bio: bio || undefined,
      photoStorageId: args.photoStorageId,
      createdAt: Date.now(),
    });

    if (args.positionAssignments) {
      for (const pa of args.positionAssignments) {
        const p = await ctx.db.get(pa.positionId);
        if (!p || p.electionId !== args.electionId) {
          throw new ConvexError("Position does not belong to this election.");
        }
        await ctx.db.insert("candidatePositions", {
          candidateId,
          positionId: pa.positionId,
          fallbackOrder: pa.fallbackOrder,
        });
      }
    }

    await audit(ctx, {
      actor: voter,
      action: "candidate.added",
      entityType: "candidates",
      entityId: candidateId,
      payload: { fullName, matric },
    });

    return candidateId;
  },
});

export const update = mutation({
  args: {
    candidateId: v.id("candidates"),
    fullName: v.optional(v.string()),
    matric: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    clearPhoto: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.candidateId);
    if (!c) throw new ConvexError("Candidate not found.");
    await requireSetupPhase(ctx, c.electionId);

    const patch: {
      fullName?: string;
      matric?: string;
      bio?: string | undefined;
      photoStorageId?: Id<"_storage"> | undefined;
    } = {};

    if (args.fullName !== undefined) {
      const v2 = args.fullName.trim();
      if (v2.length < 2 || v2.length > 120) {
        throw new ConvexError("Full name must be between 2 and 120 characters.");
      }
      patch.fullName = v2;
    }
    if (args.matric !== undefined) {
      const v2 = args.matric.trim();
      if (v2.length < 6 || v2.length > 20) {
        throw new ConvexError("Matric number must be between 6 and 20 characters.");
      }
      patch.matric = v2;
    }
    if (args.bio !== undefined) {
      const v2 = args.bio.trim();
      if (v2.length > 1000) {
        throw new ConvexError("Bio must be at most 1000 characters.");
      }
      patch.bio = v2.length === 0 ? undefined : v2;
    }
    if (args.clearPhoto) {
      if (c.photoStorageId) {
        await ctx.storage.delete(c.photoStorageId);
      }
      patch.photoStorageId = undefined;
    } else if (args.photoStorageId !== undefined) {
      if (c.photoStorageId && c.photoStorageId !== args.photoStorageId) {
        await ctx.storage.delete(c.photoStorageId);
      }
      patch.photoStorageId = args.photoStorageId;
    }

    await ctx.db.patch(c._id, patch);
    await audit(ctx, {
      actor: voter,
      action: "candidate.updated",
      entityType: "candidates",
      entityId: c._id,
    });
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.candidateId);
    if (!c) throw new ConvexError("Candidate not found.");
    await requireSetupPhase(ctx, c.electionId);

    const links = await ctx.db
      .query("candidatePositions")
      .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    if (c.photoStorageId) {
      await ctx.storage.delete(c.photoStorageId);
    }

    await ctx.db.delete(c._id);
    await audit(ctx, {
      actor: voter,
      action: "candidate.removed",
      entityType: "candidates",
      entityId: c._id,
      payload: { fullName: c.fullName, matric: c.matric },
    });
  },
});

export const setPositionAssignments = mutation({
  args: {
    candidateId: v.id("candidates"),
    assignments: v.array(
      v.object({
        positionId: v.id("positions"),
        fallbackOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { voter } = await requireAdmin(ctx);
    const c = await ctx.db.get(args.candidateId);
    if (!c) throw new ConvexError("Candidate not found.");
    await requireSetupPhase(ctx, c.electionId);

    const seen = new Set<Id<"positions">>();
    for (const a of args.assignments) {
      if (seen.has(a.positionId)) {
        throw new ConvexError(
          "Each position can only be assigned once per candidate.",
        );
      }
      seen.add(a.positionId);
      const p = await ctx.db.get(a.positionId);
      if (!p || p.electionId !== c.electionId) {
        throw new ConvexError("Position does not belong to this election.");
      }
    }

    const existing = await ctx.db
      .query("candidatePositions")
      .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
      .collect();
    for (const link of existing) await ctx.db.delete(link._id);

    for (const a of args.assignments) {
      await ctx.db.insert("candidatePositions", {
        candidateId: c._id,
        positionId: a.positionId,
        fallbackOrder: a.fallbackOrder,
      });
    }

    await audit(ctx, {
      actor: voter,
      action: "candidate.positionsUpdated",
      entityType: "candidates",
      entityId: c._id,
      payload: { count: args.assignments.length },
    });
  },
});

export const generatePhotoUploadUrl = mutation({
  args: { electionId: v.id("elections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);
    return await ctx.storage.generateUploadUrl();
  },
});

interface ImportRow {
  fullName: string;
  matric: string;
  bio?: string;
  positions?: string;
}

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export const csvImport = mutation({
  args: {
    electionId: v.id("elections"),
    rows: v.array(
      v.object({
        fullName: v.string(),
        matric: v.string(),
        bio: v.optional(v.string()),
        positions: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<ImportSummary> => {
    const { voter } = await requireAdmin(ctx);
    await requireSetupPhase(ctx, args.electionId);

    const positions = await ctx.db
      .query("positions")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const positionByName = new Map<string, Doc<"positions">>();
    for (const p of positions) positionByName.set(p.name.toLowerCase(), p);

    const existing = await ctx.db
      .query("candidates")
      .withIndex("by_election", (q) => q.eq("electionId", args.electionId))
      .collect();
    const existingMatrics = new Set(
      existing.map((c) => c.matric.toLowerCase()),
    );

    const summary: ImportSummary = { inserted: 0, skipped: 0, errors: [] };

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i] as ImportRow;
      try {
        const fullName = row.fullName.trim();
        const matric = row.matric.trim();
        if (fullName.length < 2 || matric.length < 6) {
          summary.errors.push({
            row: i + 2,
            message: "Missing or invalid fullName or matric.",
          });
          continue;
        }
        if (existingMatrics.has(matric.toLowerCase())) {
          summary.skipped += 1;
          continue;
        }

        const candidateId = await ctx.db.insert("candidates", {
          electionId: args.electionId,
          fullName,
          matric,
          bio: row.bio?.trim() || undefined,
          createdAt: Date.now(),
        });
        existingMatrics.add(matric.toLowerCase());

        if (row.positions && row.positions.trim().length > 0) {
          const names = row.positions
            .split(/[,;|]/)
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          let order = 0;
          for (const name of names) {
            const p = positionByName.get(name.toLowerCase());
            if (!p) {
              summary.errors.push({
                row: i + 2,
                message: `Unknown position "${name}" — candidate inserted without it.`,
              });
              continue;
            }
            await ctx.db.insert("candidatePositions", {
              candidateId,
              positionId: p._id,
              fallbackOrder: order++,
            });
          }
        }

        summary.inserted += 1;
      } catch (err) {
        const m = err instanceof Error ? err.message : "Unknown error";
        summary.errors.push({ row: i + 2, message: m });
      }
    }

    await audit(ctx, {
      actor: voter,
      action: "candidate.csvImported",
      entityType: "elections",
      entityId: args.electionId,
      payload: {
        inserted: summary.inserted,
        skipped: summary.skipped,
        errors: summary.errors.length,
      },
    });

    return summary;
  },
});
