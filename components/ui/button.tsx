"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: false;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[oklch(0.27_0_0)]",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[oklch(0.94_0_0)]",
  outline:
    "border bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  ghost:
    "bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  destructive:
    "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90",
  link: "text-[var(--color-brand)] underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
