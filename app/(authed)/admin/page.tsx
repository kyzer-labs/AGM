"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { getConvexErrorMessage } from "@/lib/convex-error";

interface AdminTile {
  href: string;
  technique: "Setup" | "Roster" | "Ballot ops" | "Reporting" | "Audit" | "Dev";
  title: string;
  body: string;
  badge?: string;
}

function buildTiles(opts: {
  isSuper: boolean;
  devEnabled: boolean;
}): AdminTile[] {
  const tiles: AdminTile[] = [
    {
      href: "/admin/election",
      technique: "Setup",
      title: "Election cycle",
      body: "Create the AGM cycle, schedule the internal and public windows, and set the weightage split.",
    },
    {
      href: "/admin/positions",
      technique: "Setup",
      title: "Positions and ballot order",
      body: "Define every position, its tier, and the order in which it appears on the live AGM ballot.",
    },
    {
      href: "/admin/candidates",
      technique: "Setup",
      title: "Candidates",
      body: "Add and edit candidates, attach photos, and set eligible positions per candidate.",
    },
    {
      href: "/admin/whitelist",
      technique: "Roster",
      title: "Internal whitelist",
      body: "Year 2 evaluator allowlist by single email, bulk paste, or CSV import.",
    },
    {
      href: "/admin/internal",
      technique: "Roster",
      title: "Internal evaluation",
      body: "Track which evaluators have submitted and inspect aggregate rubric scores per candidate.",
    },
    {
      href: "/admin/public",
      technique: "Ballot ops",
      title: "Public AGM voting",
      body: "Live ballot operations: open one position at a time, monitor the live count, then close.",
    },
    {
      href: "/admin/results",
      technique: "Reporting",
      title: "Results and publishing",
      body: "Review the combined breakdown, resolve any ties, and publish results to all voters.",
    },
    {
      href: "/admin/exports",
      technique: "Reporting",
      title: "Exports",
      body: "CSV downloads of voter rolls, evaluations, and the full audit log; emergency lookup.",
    },
  ];

  if (opts.isSuper) {
    tiles.push({
      href: "/admin/admins",
      technique: "Audit",
      title: "Admins",
      body: "Manage the admin allowlist. Grants, revocations, and role changes are written to the audit log.",
      badge: "Super admin",
    });
  }

  if (opts.devEnabled) {
    tiles.push({
      href: "/admin/dev",
      technique: "Dev",
      title: "Dev seeder",
      body: "Synthetic voters, evaluations, and votes for end-to-end testing without dozens of real accounts.",
      badge: "Dev only",
    });
  }

  return tiles;
}

function AdminPageInner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const superExists = useQuery(api.admins.superAdminExists);
  const devConfig = useQuery(api.dev.config);

  const isAdmin =
    adminStatus?.role === "admin" || adminStatus?.role === "super";
  const isSuper = adminStatus?.role === "super";
  const devEnabled = devConfig?.enabled === true;

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
    return <PageSkeleton />;
  }

  if (!isAdmin && superExists) {
    return null;
  }

  const tiles = isAdmin ? buildTiles({ isSuper, devEnabled }) : [];

  const headerCopy = isAdmin
    ? {
        markerSecondary: isSuper ? "Super admin" : "Admin",
        title: "AGM operations",
        body: "Configure the cycle, run live ballots, resolve ties, and publish results. Each surface lists its own next action when you open it.",
      }
    : {
        markerSecondary: "Setup pending",
        title: "Admin setup",
        body: "Become the first super admin for this deployment. Once you do, this page lists every operation needed to run the AGM.",
      };

  return (
    <main className="container-narrow space-y-12 py-12 sm:py-16">
      <header className="space-y-4">
        <SectionMarker
          primary="Admin console"
          secondary={headerCopy.markerSecondary}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {headerCopy.title}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {headerCopy.body}
        </p>
      </header>

      <BootstrapPanel />

      {isAdmin ? (
        <ol className="space-y-0" aria-label="Admin operations">
          {tiles.map((tile, index) => (
            <li key={tile.href}>
              <AdminIndexItem tile={tile} index={index} />
            </li>
          ))}
        </ol>
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

function AdminIndexItem({ tile, index }: { tile: AdminTile; index: number }) {
  return (
    <Link
      href={tile.href}
      className="group block border-t border-[var(--ink-line)] py-6 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ink)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span
          className="font-mono text-2xl font-medium tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker primary={tile.technique} />
        <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors group-hover:text-[var(--teal)] sm:text-2xl">
          {tile.title}
        </h2>
        {tile.badge ? <Badge tone="muted">{tile.badge}</Badge> : null}
      </div>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {tile.body}
      </p>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <main className="container-narrow space-y-6 py-12 sm:py-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

function BootstrapPanel() {
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
