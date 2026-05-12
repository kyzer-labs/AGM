import { useQuery } from "convex/react";
import { CheckCircle2, Sparkles, Users2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { SessionBadge } from "./session-badge";

type DevStats = ReturnType<typeof useQuery<typeof api.dev.stats>>;

export function ScenarioRunner({
  stats,
  phase,
  candidatesCount,
  onLoadTestCandidates,
  onHappyPath,
}: {
  stats: DevStats;
  phase: Doc<"elections">["phase"];
  candidatesCount: number;
  onLoadTestCandidates: () => void;
  onHappyPath: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scenario runner</CardTitle>
        <CardDescription>
          The normal path for a full local test run: load fixture
          candidates, seed evaluator and public-voter data, then advance
          the cycle through the admin screens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Fixture candidates
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Eighteen <code>[TEST_FIXTURE]</code> rows, two per
              position across all three tiers.
            </p>
            {stats !== undefined && stats !== null ? (
              <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                Loaded {stats.candidates.test} of 18
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Happy path
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Seeds evaluator voters, external voters, and submitted
              evaluations using the configured defaults.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
            <Button
              onClick={onLoadTestCandidates}
              disabled={phase !== "setup"}
            >
              <Users2 className="h-4 w-4" /> Load fixtures
            </Button>
            <Button
              variant="outline"
              onClick={onHappyPath}
              disabled={
                candidatesCount === 0 ||
                (phase !== "setup" && phase !== "internalOpen")
              }
            >
              <Sparkles className="h-4 w-4" /> Run happy path
            </Button>
          </div>
        </div>

        {stats !== undefined &&
        stats !== null &&
        stats.firstByPosition.length > 0 ? (
          <details className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
            <summary className="cursor-pointer px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] hover:text-[var(--ink)]">
              First-by-position breakdown ({stats.firstByPosition.length}{" "}
              positions)
            </summary>
            <div className="border-t border-[var(--ink-line)] px-4 py-3">
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                Under the <code>favorFirst</code> evaluation distribution
                and the <code>favorFirst</code> public vote tally, the
                candidate listed below for each position is the predicted
                winner once results are computed. Useful for verifying the
                scoring math after a happy-path run.
              </p>
              <ol className="grid gap-1.5">
                {stats.firstByPosition.map((row) => (
                  <li
                    key={row.positionId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                  >
                    <span className="font-mono text-[10.5px] tabular-nums text-[var(--ink-muted)]">
                      T{row.tier}.{String(row.order).padStart(2, "0")}
                    </span>
                    <span className="font-medium text-[var(--ink)]">
                      {row.positionName}
                    </span>
                    <span aria-hidden className="text-[var(--copper)]">
                      ·
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                      {row.candidatesAtPosition} candidates
                    </span>
                    <span aria-hidden className="text-[var(--copper)]">
                      ·
                    </span>
                    <SessionBadge status={row.sessionStatus} />
                    <span className="ml-auto flex items-center gap-2 font-mono text-xs text-[var(--ink)]">
                      {row.favorFirstWinner ? (
                        <>
                          <CheckCircle2
                            className="h-3 w-3 text-[var(--teal)]"
                            aria-hidden
                          />
                          <span>{row.favorFirstWinner.fullName}</span>
                          {row.favorFirstWinner.isTest ? (
                            <Badge tone="muted" className="text-[9px]">
                              fixture
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <span className="italic text-[var(--ink-muted)]">
                          no candidates
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
