"use client";

import { ArrowUpRight } from "lucide-react";
import { useMicrosoftSignIn } from "@/components/auth/use-microsoft-signin";
import { cn } from "@/lib/utils";

/**
 * Premium Button-in-Button sign-in CTA for the landing hero. Ink fill on
 * paper with a nested 9x9 capsule that holds the trailing arrow icon.
 * Magnetic hover (capsule slides 0.5 units), tactile press (0.98 scale),
 * 700ms cubic-bezier transitions. Reuses the auth hook so there is no
 * duplicated Microsoft sign-in logic.
 */
export function SignInCTA() {
  const { loading, signIn } = useMicrosoftSignIn();

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        "group relative inline-flex items-center gap-3 rounded-full pl-6 pr-2 py-2",
        "bg-[var(--ink)] text-[var(--paper)] text-sm font-medium",
        "shadow-[0_18px_45px_-20px_rgba(11,15,18,0.55)]",
        "transition-[transform,box-shadow,background-color] duration-700",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        "hover:shadow-[0_22px_55px_-22px_rgba(11,15,18,0.65)]",
        "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      <span className="font-display text-sm tracking-tight">
        {loading ? "Signing in" : "Sign in with Microsoft"}
      </span>
      <span
        aria-hidden
        className={cn(
          "inline-grid h-9 w-9 place-items-center rounded-full",
          "bg-[var(--paper)] text-[var(--ink)]",
          "transition-transform duration-700",
          "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          "group-hover:translate-x-0.5",
        )}
      >
        {loading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
        ) : (
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        )}
      </span>
    </button>
  );
}
