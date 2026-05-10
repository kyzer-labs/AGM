"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * `<LinkButton>` renders a Next.js `<Link>` styled like the project's
 * `<Button>`, but as a single `<a>` element so the codebase stops
 * shipping invalid `<a><button>` nesting wherever a CTA happens to
 * navigate. Tier 2 of the audit-and-rework sweep flagged the
 * `<Link href><Button>...</Button></Link>` pattern across every admin
 * EmptyState action; this primitive replaces every one of them.
 *
 * Notes:
 * - Variant + size unions and the className composition are intentionally
 *   duplicated from `components/ui/button.tsx` rather than imported, so
 *   `<Button>` keeps its existing public surface untouched. **Keep the
 *   constants below in sync with `components/ui/button.tsx` whenever the
 *   button visual contract changes.**
 * - There is no `loading` state: an anchor cannot be busy in the same
 *   sense as a `<button>`, and no current call site needs it. Escalate
 *   if a future caller does.
 * - When `target="_blank"` is passed, `rel` defaults to
 *   `"noopener noreferrer"` for external-link safety, unless the caller
 *   provides an explicit `rel`.
 */

// keep in sync with components/ui/button.tsx
type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
type Size = "sm" | "md" | "lg" | "icon";

// keep in sync with components/ui/button.tsx
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

// keep in sync with components/ui/button.tsx
const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,white_12%)]",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[color-mix(in_oklab,var(--color-secondary)_70%,var(--color-foreground)_8%)]",
  outline:
    "border bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  ghost:
    "bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  destructive:
    "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90",
  link: "text-[var(--color-brand)] underline-offset-4 hover:underline",
};

// keep in sync with components/ui/button.tsx
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;

export interface LinkButtonProps extends Omit<LinkProps, "className"> {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    {
      className,
      variant = "primary",
      size = "md",
      target,
      rel,
      children,
      ...rest
    },
    ref,
  ) {
    const safeRel =
      target === "_blank" ? (rel ?? "noopener noreferrer") : rel;
    return (
      <Link
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        target={target}
        rel={safeRel}
        {...rest}
      >
        {children}
      </Link>
    );
  },
);
