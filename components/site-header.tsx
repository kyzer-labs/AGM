"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Vote } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";

export function SiteHeader() {
  const me = useQuery(api.voters.me);

  return (
    <header className="border-b bg-[var(--color-background)]/80 backdrop-blur sticky top-0 z-30">
      <div className="container-wide flex h-14 items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <Vote className="h-4 w-4" aria-hidden />
          </span>
          <span>USM CSS AGM</span>
        </Link>
        <div className="flex items-center gap-3">
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
