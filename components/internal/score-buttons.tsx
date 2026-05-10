"use client";

import { cn } from "@/lib/utils";

export function ScoreButtons({
  value,
  maxScore = 5,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number | undefined;
  maxScore?: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const scores = Array.from({ length: maxScore }, (_, i) => i + 1);
  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {scores.map((s) => {
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            role="radio"
            aria-checked={selected}
            aria-label={`${s}`}
            className={cn(
              "h-8 w-8 rounded-md border text-sm font-medium tabular-nums",
              "transition-[colors,transform,border-color] duration-150 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              "active:scale-[0.94]",
              selected
                ? "border-[var(--color-foreground)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "border-[var(--color-border)] bg-transparent hover:border-[var(--color-foreground)]/40 hover:bg-[var(--color-muted)]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
