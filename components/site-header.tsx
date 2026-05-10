"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

type Phase = Doc<"elections">["phase"];

interface AdminNavItem {
  href: string;
  label: string;
  superOnly?: boolean;
  devOnly?: boolean;
}

const CYCLE_NAV: AdminNavItem[] = [
  { href: "/admin/election", label: "Cycle overview" },
  { href: "/admin/positions", label: "Positions" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/whitelist", label: "Whitelist" },
];

const RECORD_NAV: AdminNavItem[] = [
  { href: "/admin/results", label: "Published results" },
  { href: "/admin/exports", label: "Exports and audit" },
];

const TOOL_NAV: AdminNavItem[] = [
  { href: "/admin/dev", label: "Dev seed", devOnly: true },
  { href: "/admin/admins", label: "Admins", superOnly: true },
];

export function SiteHeader() {
  const me = useQuery(api.voters.me);
  const pathname = usePathname();
  const current = useQuery(api.elections.getCurrent);
  const devConfig = useQuery(api.dev.config);
  const isAdmin = me?.role === "admin" || me?.role === "super";
  const brandHref = isAdmin ? "/admin" : "/dashboard";
  const devEnabled = devConfig?.enabled === true;

  return (
    <header className="sticky top-0 z-30 border-b bg-[var(--color-background)]/90 backdrop-blur">
      <div className="mx-auto grid min-h-14 w-[min(96vw,104rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href={brandHref}
          className="flex shrink-0 items-center gap-2 justify-self-start font-semibold tracking-tight"
        >
          <Image
            src="/logos/cs-soc-official.svg"
            alt="USM CS Society"
            width={36}
            height={36}
            priority
            className="h-9 w-9"
          />
          <span>USM CSS AGM</span>
        </Link>

        {isAdmin ? (
          <AdminNav
            pathname={pathname}
            phase={current?.phase}
            isSuper={me?.role === "super"}
            devEnabled={devEnabled}
          />
        ) : null}

        <div className="flex items-center gap-3 justify-self-end">
          {me ? (
            <>
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">
                  {me.fullName ?? me.email}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {me.email}
                </span>
              </div>
              {me.role === "super" ? (
                <Badge tone="brand">Super admin</Badge>
              ) : me.role === "admin" ? (
                <Badge tone="brand">Admin</Badge>
              ) : null}
              <SignOutButton />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function AdminNav({
  pathname,
  phase,
  isSuper,
  devEnabled,
}: {
  pathname: string;
  phase?: Phase;
  isSuper: boolean;
  devEnabled: boolean;
}) {
  const tools = TOOL_NAV.filter((item) => {
    if (item.superOnly && !isSuper) return false;
    if (item.devOnly && !devEnabled) return false;
    return true;
  });
  const runTarget = getRunTarget(phase);

  return (
    <nav
      className="flex min-w-[min(100%,28rem)] flex-1 flex-wrap items-center justify-center gap-1.5"
      aria-label="Admin navigation"
    >
      <AdminNavPill href="/admin" label="Command" pathname={pathname} />
      <AdminNavMenu label="Cycle" items={CYCLE_NAV} pathname={pathname} />
      <AdminNavPill
        href={runTarget.href}
        label={runTarget.label}
        pathname={pathname}
        phaseRelevant={runTarget.phaseRelevant}
      />
      <AdminNavMenu label="Records" items={RECORD_NAV} pathname={pathname} />
      {tools.length > 0 ? (
        <AdminNavMenu label="Tools" items={tools} pathname={pathname} subtle />
      ) : null}
    </nav>
  );
}

function AdminNavPill({
  href,
  label,
  pathname,
  phaseRelevant = false,
}: {
  href: string;
  label: string;
  pathname: string;
  phaseRelevant?: boolean;
}) {
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        active
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
          : phaseRelevant
            ? "border-[var(--teal)] bg-[color-mix(in_oklab,var(--teal)_10%,transparent)] text-[var(--ink)]"
            : "border-[var(--ink-line)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--paper-2)]",
      )}
    >
      {label}
    </Link>
  );
}

function AdminNavMenu({
  label,
  items,
  pathname,
  subtle = false,
}: {
  label: string;
  items: AdminNavItem[];
  pathname: string;
  subtle?: boolean;
}) {
  const active = items.some((item) => pathname === item.href);

  return (
    <div className="group relative">
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
          active
            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
            : subtle
              ? "border-transparent text-[var(--ink-muted)] hover:border-[var(--ink-line)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              : "border-[var(--ink-line)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--paper-2)]",
        )}
      >
        {label}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
          aria-hidden
        />
      </button>
      <div className="invisible absolute left-0 top-9 z-40 min-w-48 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-1.5 opacity-0 shadow-lg transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {items.map((item) => {
          const itemActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={itemActive ? "page" : undefined}
              className={cn(
                "block rounded-sm px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                itemActive
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "text-[var(--ink)] hover:bg-[var(--paper-2)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function getRunTarget(phase?: Phase): {
  href: string;
  label: string;
  phaseRelevant: boolean;
} {
  if (phase === "internalOpen" || phase === "internalClosed") {
    return { href: "/admin/internal", label: "Run: Internal", phaseRelevant: true };
  }
  if (phase === "publicVoting") {
    return { href: "/admin/public", label: "Run: Live", phaseRelevant: true };
  }
  if (phase === "resultsPreview") {
    return { href: "/admin/results", label: "Run: Results", phaseRelevant: true };
  }
  if (phase === "published") {
    return { href: "/admin/exports", label: "Post-cycle", phaseRelevant: true };
  }
  return { href: "/admin/election", label: "Run: Setup", phaseRelevant: phase === "setup" };
}
