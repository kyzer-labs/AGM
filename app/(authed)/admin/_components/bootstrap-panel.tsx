"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";

export function BootstrapPanel() {
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const bootstrap = useMutation(api.admins.bootstrapSuperAdmin);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (adminStatus !== null) return null;
  if (!me?.profileComplete) return null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await bootstrap({ token });
      toast.success("Super admin granted to your account.");
    } catch (err) {
      const message = getConvexErrorMessage(err, "Bootstrap failed.");
      toast.error("Bootstrap failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NoticeStrip
      markerPrimary="First-time setup"
      markerSecondary="Required"
      headline="Become super admin"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        No super admin exists yet. Paste the{" "}
        <code className="rounded bg-[var(--paper)] px-1.5 py-0.5 font-mono text-xs">
          SUPER_ADMIN_BOOTSTRAP_TOKEN
        </code>{" "}
        you set on the Convex deployment to claim super admin for{" "}
        <strong className="font-semibold text-[var(--ink)]">{me.email}</strong>
        . This bootstrap path can be used exactly once.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:flex sm:items-end">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="bootstrap-token">Bootstrap token</Label>
          <Input
            id="bootstrap-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste the token from your Convex env"
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" loading={submitting}>
          Become super admin
        </Button>
      </form>
    </NoticeStrip>
  );
}
