import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type AuditPayload = Record<string, string | number | boolean | null>;

interface AuditArgs {
  actor?: Doc<"voters"> | null;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: AuditPayload;
  reason?: string;
}

export async function audit(
  ctx: MutationCtx,
  { actor, action, entityType, entityId, payload, reason }: AuditArgs,
): Promise<void> {
  await ctx.db.insert("auditLog", {
    actorVoterId: actor?._id,
    actorEmail: actor?.email,
    action,
    entityType,
    entityId,
    payload,
    reason,
    createdAt: Date.now(),
  });
}
