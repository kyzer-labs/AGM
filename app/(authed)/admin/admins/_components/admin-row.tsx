"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Clock3,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import { ROLE_LABEL, type AdminListEntry } from "./admins-model";

export function AdminRow({
  entry,
  isSelf,
  onlyOneSuper,
}: {
  entry: AdminListEntry;
  isSelf: boolean;
  onlyOneSuper: boolean;
}) {
  const dialog = useDialog();
  const revoke = useMutation(api.admins.revokeAdmin);
  const [busy, setBusy] = useState(false);

  const wouldOrphan =
    entry.role === "super" && onlyOneSuper && !entry.pending;

  const onRevoke = async () => {
    const ok = await dialog.confirm({
      title:
        entry.role === "super"
          ? "Revoke super admin access?"
          : "Revoke admin access?",
      description: (
        <>
          Remove{" "}
          <strong className="font-semibold">
            {entry.fullName ?? entry.email}
          </strong>{" "}
          ({entry.email}) from the admin allowlist. They lose every
          permission attached to the{" "}
          <strong className="font-semibold">
            {ROLE_LABEL[entry.role]}
          </strong>{" "}
          role, including access to the admin tree, on their next request.
          The action is recorded in the audit log against your account and
          cannot be undone from this page; you would need to re-grant the
          role.
        </>
      ),
      confirmText: "Revoke access",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await revoke({ adminId: entry._id });
      toast.success("Access revoked", {
        description: `${entry.email} has been removed from the allowlist.`,
      });
    } catch (err) {
      toast.error("Revoke failed", {
        description: getConvexErrorMessage(err, "Revoke failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
      <Badge tone={entry.role === "super" ? "copper" : "brand"}>
        {entry.role === "super" ? (
          <>
            <ShieldCheck className="h-3 w-3" aria-hidden /> Super admin
          </>
        ) : (
          <>
            <ShieldOff className="h-3 w-3" aria-hidden /> Admin
          </>
        )}
      </Badge>
      {entry.pending ? (
        <Badge tone="warning">
          <Clock3 className="h-3 w-3" aria-hidden /> Pending sign-in
        </Badge>
      ) : null}
      {isSelf ? (
        <Badge tone="muted" aria-label="This is your own account">
          You
        </Badge>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[var(--ink)]">
          {entry.fullName ?? entry.email}
        </div>
        <div className="truncate font-mono text-xs tabular-nums text-[var(--ink-muted)]">
          {entry.email}
          <span aria-hidden className="px-1 text-[var(--copper)]">
            ·
          </span>
          {entry.pending ? "Invited" : "Added"} {formatMYT(entry.createdAt)}
        </div>
      </div>
      {isSelf ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Self-revoke disabled
        </span>
      ) : wouldOrphan ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--copper)]">
          Last super admin
        </span>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          onClick={onRevoke}
          loading={busy}
          aria-label={`Revoke ${ROLE_LABEL[entry.role].toLowerCase()} access for ${entry.email}`}
        >
          <Trash2
            className="h-4 w-4 text-[var(--color-destructive)]"
            aria-hidden
          />
        </Button>
      )}
    </li>
  );
}
