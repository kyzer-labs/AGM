import { useQuery } from "convex/react";
import { FlaskConical, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SectionMarker } from "@/components/ui/section-marker";
import { Select } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { NumberField } from "./number-field";
import {
  DISTRIBUTION_LABEL,
  TALLY_LABEL,
  type Distribution,
  type VoteTallyKind,
} from "./dev-model";

type Positions = ReturnType<typeof useQuery<typeof api.positions.list>>;

export function AdvancedSeedControls({
  phase,
  candidatesCount,
  positionsCount,
  positions,
  tcCount,
  heCount,
  y2Count,
  externalCount,
  distribution,
  submittedToggle,
  voteTotal,
  voteKind,
  tiePositionId,
  tiePerCandidate,
  onTcCountChange,
  onHeCountChange,
  onY2CountChange,
  onExternalCountChange,
  onDistributionChange,
  onSubmittedToggleChange,
  onVoteTotalChange,
  onVoteKindChange,
  onTiePositionIdChange,
  onTiePerCandidateChange,
  onSeedEvaluators,
  onSeedExternal,
  onSeedEvaluations,
  onSeedVotes,
  onEngineerTie,
}: {
  phase: Doc<"elections">["phase"];
  candidatesCount: number;
  positionsCount: number;
  positions: Positions;
  tcCount: number;
  heCount: number;
  y2Count: number;
  externalCount: number;
  distribution: Distribution;
  submittedToggle: boolean;
  voteTotal: number;
  voteKind: VoteTallyKind;
  tiePositionId: Id<"positions"> | "";
  tiePerCandidate: number;
  onTcCountChange: (n: number) => void;
  onHeCountChange: (n: number) => void;
  onY2CountChange: (n: number) => void;
  onExternalCountChange: (n: number) => void;
  onDistributionChange: (value: Distribution) => void;
  onSubmittedToggleChange: (value: boolean) => void;
  onVoteTotalChange: (n: number) => void;
  onVoteKindChange: (value: VoteTallyKind) => void;
  onTiePositionIdChange: (value: Id<"positions"> | "") => void;
  onTiePerCandidateChange: (n: number) => void;
  onSeedEvaluators: () => void;
  onSeedExternal: () => void;
  onSeedEvaluations: () => void;
  onSeedVotes: () => void;
  onEngineerTie: () => void;
}) {
  return (
    <section aria-label="Advanced seed controls">
      <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SectionMarker
            primary="Advanced seed controls"
            secondary="Manual overrides"
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
            Expand only when you need a specific data shape
          </p>
        </div>
      </header>
      <div className="grid gap-2">
        <details className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Voter pools
          </summary>
          <div className="grid gap-4 border-t border-[var(--ink-line)] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Top Committee"
                value={tcCount}
                onChange={onTcCountChange}
              />
              <NumberField
                label="Head Executive"
                value={heCount}
                onChange={onHeCountChange}
              />
              <NumberField
                label="Year 2 Committee"
                value={y2Count}
                onChange={onY2CountChange}
              />
            </div>
            <Button
              onClick={onSeedEvaluators}
              disabled={phase !== "setup" && phase !== "internalOpen"}
            >
              <Sparkles className="h-4 w-4" /> Seed evaluator voters
            </Button>

            <div className="border-t pt-6 grid gap-3">
              <NumberField
                label="External voters (must be >= votes per position)"
                value={externalCount}
                onChange={onExternalCountChange}
              />
              <Button onClick={onSeedExternal}>
                <Sparkles className="h-4 w-4" /> Seed external voters
              </Button>
            </div>
          </div>
        </details>

        <details className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Internal evaluations
          </summary>
          <Card className="rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Internal evaluations</CardTitle>
              <CardDescription>
                Writes a full N evaluators × M candidates × K criteria score
                matrix. Idempotent: re-running with the same seed voters
                overwrites their scores. Requires{" "}
                {candidatesCount === 0 ? (
                  <em>candidates first.</em>
                ) : (
                  <>
                    {candidatesCount} candidate(s) and {positionsCount}{" "}
                    position(s) currently configured.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="grid gap-1.5 sm:flex-1">
                <Label htmlFor="dist">Score distribution</Label>
                <Select
                  id="dist"
                  value={distribution}
                  onChange={(e) =>
                    onDistributionChange(e.target.value as Distribution)
                  }
                >
                  {(Object.keys(DISTRIBUTION_LABEL) as Distribution[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {DISTRIBUTION_LABEL[k]}
                      </option>
                    ),
                  )}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sub">Mark as</Label>
                <Select
                  id="sub"
                  value={submittedToggle ? "submitted" : "draft"}
                  onChange={(e) =>
                    onSubmittedToggleChange(e.target.value === "submitted")
                  }
                >
                  <option value="submitted">Submitted</option>
                  <option value="draft">Draft</option>
                </Select>
              </div>
              <Button
                onClick={onSeedEvaluations}
                disabled={candidatesCount === 0}
              >
                <FlaskConical className="h-4 w-4" /> Seed evaluations
              </Button>
            </CardContent>
          </Card>
        </details>

        <details className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Public votes
          </summary>
          <Card className="rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Public votes</CardTitle>
              <CardDescription>
                Distributes <code>totalVotes</code> across each position&apos;s
                candidates. Use this with the cycle in <code>publicVoting</code>{" "}
                (open and close ballots manually from the public ops page; the
                seeded votes are picked up at close time).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:flex sm:items-end sm:gap-4">
              <NumberField
                label="Votes per position"
                value={voteTotal}
                onChange={onVoteTotalChange}
                className="sm:flex-1"
              />
              <div className="grid gap-1.5 sm:flex-1">
                <Label htmlFor="tally">Tally shape</Label>
                <Select
                  id="tally"
                  value={voteKind}
                  onChange={(e) =>
                    onVoteKindChange(e.target.value as VoteTallyKind)
                  }
                >
                  {(Object.keys(TALLY_LABEL) as VoteTallyKind[]).map((k) => (
                    <option key={k} value={k}>
                      {TALLY_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={onSeedVotes}>
                <FlaskConical className="h-4 w-4" /> Seed public votes
              </Button>
            </CardContent>
          </Card>
        </details>

        <details className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Engineered tie
          </summary>
          <Card className="rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Engineered tie</CardTitle>
              <CardDescription>
                Forces a deep tie at the chosen position by giving its top two
                candidates identical class shares (max scores from every
                evaluator) and identical public vote counts. Closing the ballot
                should drop straight to the manual-tie resolver.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="grid gap-1.5 sm:flex-1">
                <Label htmlFor="tiepos">Position</Label>
                <Select
                  id="tiepos"
                  value={tiePositionId}
                  onChange={(e) =>
                    onTiePositionIdChange(
                      e.target.value as Id<"positions"> | "",
                    )
                  }
                >
                  <option value="">Select position...</option>
                  {(positions ?? []).map((p) => (
                    <option key={p._id} value={p._id}>
                      Tier {p.tier} · {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <NumberField
                label="Votes per top candidate"
                value={tiePerCandidate}
                onChange={onTiePerCandidateChange}
              />
              <Button onClick={onEngineerTie} disabled={!tiePositionId}>
                <Wand2 className="h-4 w-4" /> Engineer tie
              </Button>
            </CardContent>
          </Card>
        </details>
      </div>
    </section>
  );
}
