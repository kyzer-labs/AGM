"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Category {
  key: string;
  label: string;
  bullets: string[];
}

const CATEGORIES: Category[] = [
  {
    key: "leadership",
    label: "Leadership",
    bullets: [
      "Visionary and mature thinking",
      "Leadership and inspiration",
      "Accountability",
      "Strategic decision-making",
      "Task supervision and delegation",
    ],
  },
  {
    key: "teamwork",
    label: "Teamwork & Communication",
    bullets: [
      "Team collaboration",
      "Willingness to listen",
      "Conflict resolution and management",
      "Clear communication",
    ],
  },
  {
    key: "professionalism",
    label: "Professionalism & Ethics",
    bullets: [
      "Trustworthiness",
      "Reliability",
      "Moral integrity",
      "Follows rules and standards",
      "Acts as a role model",
    ],
  },
  {
    key: "commitment",
    label: "Commitment",
    bullets: [
      "Deadline adherence",
      "Task prioritization and attitude",
      "Initiative and enthusiasm",
      "Engagement in discussions",
    ],
  },
  {
    key: "personality",
    label: "Personality",
    bullets: [
      "Politeness and humility",
      "Thoughtfulness and consideration",
      "Friendliness",
      "Positivity",
      "Networking ability",
    ],
  },
];

const SCORE_LEGEND: { score: number; label: string }[] = [
  { score: 5, label: "Excellent" },
  { score: 4, label: "Competent" },
  { score: 3, label: "Average" },
  { score: 2, label: "Satisfactory" },
  { score: 1, label: "Unsatisfactory" },
];

export function RubricHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-[var(--color-card)]">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-between rounded-lg px-4 py-3"
      >
        <span className="text-sm font-medium">Rubric reference</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            open ? "rotate-180" : undefined,
          )}
          aria-hidden
        />
      </Button>
      {open ? (
        <div className="space-y-4 border-t p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-5">
            {SCORE_LEGEND.map((s) => (
              <div
                key={s.score}
                className="rounded-md border px-3 py-2 text-xs"
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
            {CATEGORIES.map((c) => (
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
