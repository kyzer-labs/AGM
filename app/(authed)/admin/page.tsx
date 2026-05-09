"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/auth-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getConvexErrorMessage } from "@/lib/convex-error";

function AdminPageInner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const superExists = useQuery(api.admins.superAdminExists);

  const isAdmin = adminStatus?.role === "admin" || adminStatus?.role === "super";

  useEffect(() => {
    if (
      adminStatus === undefined ||
      superExists === undefined ||
      me === undefined
    ) {
      return;
    }
    if (!isAdmin && superExists) {
      router.replace("/dashboard");
    }
  }, [adminStatus, superExists, me, isAdmin, router]);

  if (
    me === undefined ||
    adminStatus === undefined ||
    superExists === undefined
  ) {
    return (
      <main className="container-wide py-10 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!isAdmin && superExists) {
    return null;
  }

  return (
    <main className="container-wide py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin console
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Set up the election, monitor voting, and publish results.
          </p>
        </div>
        {isAdmin ? (
          <Badge tone="brand">
            <ShieldCheck className="h-3 w-3" aria-hidden />{" "}
            {adminStatus?.role === "super" ? "Super admin" : "Admin"}
          </Badge>
        ) : null}
      </header>

      <BootstrapPanel />

      {isAdmin ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Tile
            title="Election cycle"
            description="Create and configure the AGM cycle for this year."
            href="/admin/election"
          />
          <Tile
            title="Positions & ballot order"
            description="Define hierarchy and the live AGM ballot order."
            href="/admin/positions"
          />
          <Tile
            title="Candidates"
            description="Add/edit candidates, photos, and eligible positions."
            href="/admin/candidates"
          />
          <Tile
            title="Internal whitelist"
            description="Year 2 evaluator allowlist (single + bulk + CSV)."
            href="/admin/whitelist"
          />
          <Tile
            title="Internal evaluation"
            description="Track submissions and aggregate rubric scores."
            href="/admin/internal"
          />
          <Tile
            title="Public AGM voting"
            description="Run live ballots one at a time with live counts."
            href="/admin/public"
          />
          <Tile
            title="Results & publishing"
            description="Preview combined results, resolve ties, and publish."
            href="/admin/results"
          />
          <Tile
            title="Exports"
            description="CSV downloads + emergency audit lookup."
            href="/admin/exports"
          />
          {adminStatus?.role === "super" ? (
            <Tile
              title="Admins"
              description="Super admins manage the admin allowlist."
              href="/admin/admins"
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGate mode="profileComplete">
      <AdminPageInner />
    </AuthGate>
  );
}

function Tile({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-[var(--color-foreground)]/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {badge ? <Badge tone="muted">{badge}</Badge> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function BootstrapPanel() {
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const bootstrap = useMutation(api.admins.bootstrapSuperAdmin);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (adminStatus !== null) {
    return null;
  }
  if (!me?.profileComplete) {
    return null;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await bootstrap({ token });
      toast.success("Super admin granted to your account.");
    } catch (err) {
      const message =
        getConvexErrorMessage(err, "Bootstrap failed.");
      toast.error("Bootstrap failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-[var(--color-warning)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound
            className="h-4 w-4 text-[var(--color-warning)]"
            aria-hidden
          />
          <CardTitle className="text-base">First-time setup</CardTitle>
        </div>
        <CardDescription>
          No super admin exists yet. Paste the{" "}
          <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs">
            SUPER_ADMIN_BOOTSTRAP_TOKEN
          </code>{" "}
          you set in the Convex deployment env to claim super admin for{" "}
          <strong>{me.email}</strong>. This works only once.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
