"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, UserPlus } from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { AdminRow } from "./admin-row";
import {
  ROLE_LABEL,
  grantSchema,
  type AdminListEntry,
  type GrantValues,
} from "./admins-model";
import { GrantForm } from "./grant-form";

export function AdminsBody({
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
