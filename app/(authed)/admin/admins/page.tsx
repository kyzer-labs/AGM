"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock3,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMYT } from "@/lib/format";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Id } from "@/convex/_generated/dataModel";

const grantSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Must be a valid email")
    .refine(
      (e) => e.endsWith("@student.usm.my"),
      "Must end in @student.usm.my",
    ),
  role: z.enum(["super", "admin"]),
});
type GrantValues = z.infer<typeof grantSchema>;

const ROLE_LABEL: Record<"super" | "admin", string> = {
  super: "Super admin",
  admin: "Admin",
};

const ROLE_DESCRIPTION: Record<"super" | "admin", string> = {
  super:
    "Everything the admin role can do, plus managing the admin allowlist, resolving manual ties, and running the emergency voter-audit lookup.",
  admin:
    "Configure the cycle, run live ballots, monitor counts, and publish results. Cannot manage admins or run emergency audits.",
};

export default function AdminsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const list = useQuery(api.admins.listAdmins);

  const isSuper = adminStatus?.role === "super";

  useEffect(() => {
    if (adminStatus === undefined) return;
    if (!isSuper) router.replace("/admin");
  }, [adminStatus, isSuper, router]);

  if (
    adminStatus === undefined ||
    list === undefined ||
    me === undefined
  ) {
    return <PageSkeleton />;
  }

  if (!isSuper || me === null) return null;

  return <Body actorEmail={me.email} list={list} />;
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

interface AdminListEntry {
  _id: Id<"admins">;
  email: string;
  role: "super" | "admin";
  fullName: string | null;
  pending: boolean;
  createdAt: number;
}

function Body({
  actorEmail,
  list,
}: {
  actorEmail: string;
  list: AdminListEntry[];
}) {
  const grant = useMutation(api.admins.grantAdmin);
  const [showGrant, setShowGrant] = useState(false);

  const form = useForm<GrantValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { email: "", role: "admin" },
  });

  const counts = useMemo(() => {
    let supers = 0;
    let admins = 0;
    let pending = 0;
    for (const a of list) {
      if (a.role === "super") supers += 1;
      else admins += 1;
      if (a.pending) pending += 1;
    }
    return { supers, admins, pending, total: list.length };
  }, [list]);

  const onlyOneSuper = counts.supers === 1;

  const onGrant = form.handleSubmit(async (values) => {
    try {
      const result = await grant(values);
      if (result.pending) {
        toast.success("Grant queued: pending sign-in", {
          description: `${values.email} becomes ${ROLE_LABEL[values.role].toLowerCase()} the first time they sign in with their @student.usm.my account.`,
        });
      } else {
        toast.success(`${ROLE_LABEL[values.role]} access granted`, {
          description: `${values.email} can now use the admin tree.`,
        });
      }
      form.reset({ email: "", role: "admin" });
      setShowGrant(false);
    } catch (err) {
      toast.error("Grant failed", {
        description: getConvexErrorMessage(err, "Grant failed."),
      });
    }
  });

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Admins" }]} />

      <header className="space-y-3">
        <SectionMarker
          primary="Admin allowlist"
          secondary="Super admin only"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
            Access control and operator succession
          </h1>
          <Button
            className="shrink-0 sm:self-start"
            onClick={() => {
              form.reset({ email: "", role: "admin" });
              setShowGrant(true);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden /> Grant admin
          </Button>
        </div>
        <MetaGroup className="grid-cols-2 gap-4 pt-3 sm:grid-cols-4">
          <Meta label="Super admins" value={counts.supers} />
          <Meta label="Admins" value={counts.admins} />
          <Meta label="Pending sign-in" value={counts.pending} />
          <Meta label="Total" value={counts.total} />
        </MetaGroup>
      </header>

      {onlyOneSuper ? (
        <NoticeStrip
          markerPrimary="Single super admin"
          markerSecondary="Succession plan"
          markerIcon={
            <AlertTriangle
              className="h-4 w-4 text-[var(--copper)]"
              aria-hidden
            />
          }
          headline="Only one super admin on file"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Super admins can revoke other admins, run emergency voter
            audits, and resolve manual ties. If the only super admin loses
            access, the portal can no longer be unlocked from inside the
            app. Promote a second{" "}
            <strong className="font-semibold">Super admin</strong> from the
            Grant admin button above before the next AGM cycle so the
            allowlist has a working succession path.
          </p>
        </NoticeStrip>
      ) : null}

      <Modal
        open={showGrant}
        onClose={() => {
          if (!form.formState.isSubmitting) setShowGrant(false);
        }}
        title="Grant admin access"
        description="Choose a role and enter a USM student email. The grant is recorded in the audit log either way; if the recipient has not signed in yet, it is queued and activates on first sign-in."
        size="md"
      >
        <GrantForm
          form={form}
          onSubmit={onGrant}
          onCancel={() => setShowGrant(false)}
        />
      </Modal>

      <section aria-label="Admin allowlist">
        <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SectionMarker
            primary="Allowlist"
            secondary={`${counts.total} ${counts.total === 1 ? "entry" : "entries"}`}
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
            Grants activate on first sign-in
          </p>
        </header>
        {list.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            title="No admins on file"
            description="Use the Grant admin button above to add the first one. Grants for accounts that have not signed in yet are queued and activate on first sign-in."
          />
        ) : (
          <ul
            className="divide-y divide-[var(--ink-line)] rounded-md border border-[var(--ink-line)] bg-[var(--paper)]"
          >
            {list.map((entry) => (
              <AdminRow
                key={entry._id}
                entry={entry}
                isSelf={entry.email === actorEmail}
                onlyOneSuper={onlyOneSuper}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function GrantForm({
  form,
  onSubmit,
  onCancel,
}: {
  form: ReturnType<typeof useForm<GrantValues>>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  onCancel: () => void;
}) {
  const emailId = useId();
  const roleId = useId();
  const emailErrId = useId();

  const role = form.watch("role");

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor={emailId}>Student email</Label>
        <Input
          id={emailId}
          type="email"
          placeholder="someone@student.usm.my"
          autoComplete="off"
          aria-required="true"
          aria-invalid={form.formState.errors.email ? "true" : undefined}
          aria-describedby={
            form.formState.errors.email ? emailErrId : undefined
          }
          autoFocus
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p
            id={emailErrId}
            role="alert"
            className="text-xs text-[var(--color-destructive)]"
          >
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={roleId}>Role</Label>
        <Select id={roleId} {...form.register("role")}>
          <option value="admin">Admin</option>
          <option value="super">Super admin</option>
        </Select>
        <p className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          {ROLE_DESCRIPTION[role]}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          <UserPlus className="h-4 w-4" aria-hidden /> Grant {ROLE_LABEL[role].toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

function AdminRow({
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
