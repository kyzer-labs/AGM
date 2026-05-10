"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RUBRIC_CATEGORIES,
  SCORE_LEGEND,
} from "@/lib/rubric-categories";

export function RubricHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper)]">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-between rounded-lg px-4 py-3"
        aria-expanded={open}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Rubric reference
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
            open ? "rotate-180" : undefined,
          )}
          aria-hidden
        />
      </Button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--ink-line)] p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-5">
            {SCORE_LEGEND.slice()
              .reverse()
              .map((s) => (
                <div
                  key={s.score}
                  className="rounded-md border border-[var(--ink-line)] px-3 py-2 text-xs"
                >
                  <div className="text-base font-semibold tabular-nums">
                    {s.score}
                  </div>
                  <div className="text-[var(--color-muted-foreground)]">
                    {s.label}
                  </div>
                </div>
              ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {RUBRIC_CATEGORIES.map((c) => (
              <div key={c.key}>
                <div className="text-sm font-semibold">{c.label}</div>
                <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-muted-foreground)]">
                  {c.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
