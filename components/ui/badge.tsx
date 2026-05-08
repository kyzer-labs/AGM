import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const tones: Record<Tone, string> = {
  neutral:
    "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] border-transparent",
  brand: "bg-[var(--color-brand)] text-[var(--color-brand-foreground)] border-transparent",
  success:
    "bg-[var(--color-success)] text-[var(--color-success-foreground)] border-transparent",
  warning:
    "bg-[var(--color-warning)] text-[var(--color-warning-foreground)] border-transparent",
  destructive:
    "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] border-transparent",
  muted:
    "bg-transparent text-[var(--color-muted-foreground)] border-[var(--color-border)]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
