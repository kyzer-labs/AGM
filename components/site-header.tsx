"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";

export function SiteHeader() {
  const me = useQuery(api.voters.me);
  const isAdmin = me?.role === "admin" || me?.role === "super";
  const brandHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <header className="border-b bg-[var(--color-background)]/80 backdrop-blur sticky top-0 z-30">
      <div className="container-wide flex h-14 items-center justify-between gap-4">
        <Link
          href={brandHref}
          className="flex items-center gap-2 font-semibold tracking-tight"
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
