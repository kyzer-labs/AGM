"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Beaker } from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { AdvancedSeedControls } from "./advanced-seed-controls";
import { DangerZone } from "./danger-zone";
import {
  PHASE_LABELS,
  type Distribution,
  type VoteTallyKind,
} from "./dev-model";
import { ScenarioRunner } from "./scenario-runner";
import { SeedInventory } from "./seed-inventory";

export function DevBody({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const stats = useQuery(api.dev.stats, { electionId: election._id });
  const positions = useQuery(api.positions.list, {
    electionId: election._id,
  });
  const candidates = useQuery(api.candidates.list, {
    electionId: election._id,
  });

  const seedEvaluatorVoters = useMutation(api.dev.seedEvaluatorVoters);
  const seedExternalVoters = useMutation(api.dev.seedExternalVoters);
  const seedInternalEvaluations = useMutation(api.dev.seedInternalEvaluations);
  const seedPublicVotes = useMutation(api.dev.seedPublicVotes);
  const engineerTieAtPosition = useMutation(api.dev.engineerTieAtPosition);
  const wipeSeedData = useMutation(api.dev.wipeSeedData);
  const runHappyPathScenario = useMutation(api.dev.runHappyPathScenario);
  const loadTestCandidates = useMutation(api.dev.loadTestCandidates);
  const wipeTestCandidates = useMutation(api.dev.wipeTestCandidates);
  const wipeAll = useMutation(api.dev.wipeAll);

  const [tcCount, setTcCount] = useState(4);
  const [heCount, setHeCount] = useState(3);
  const [y2Count, setY2Count] = useState(3);
  const [externalCount, setExternalCount] = useState(40);
  const [distribution, setDistribution] = useState<Distribution>("uniform");
  const [submittedToggle, setSubmittedToggle] = useState(true);
  const [voteTotal, setVoteTotal] = useState(30);
  const [voteKind, setVoteKind] = useState<VoteTallyKind>("favorFirst");
  const [tiePositionId, setTiePositionId] = useState<Id<"positions"> | "">("");
  const [tiePerCandidate, setTiePerCandidate] = useState(10);

  const phase = election.phase;
  const candidatesCount = candidates?.length ?? 0;
  const positionsCount = positions?.length ?? 0;

  const wrap = async <T,>(
    label: string,
    fn: () => Promise<T>,
    summarize?: (result: T) => string,
  ): Promise<void> => {
    try {
      const result = await fn();
      toast.success(label, {
        description: summarize ? summarize(result) : undefined,
      });
    } catch (err) {
      toast.error(label, {
        description: getConvexErrorMessage(err, "Seed failed."),
      });
    }
  };

  const onSeedEvaluators = () =>
    wrap(
      "Evaluator voters seeded",
      () =>
        seedEvaluatorVoters({
          electionId: election._id,
          perClass: {
            topCommittee: tcCount,
            headExecutive: heCount,
            year2Committee: y2Count,
          },
        }),
      (r) =>
        `${r.votersInserted} voters added, ${r.votersReused} reused, ${r.whitelistInserted} whitelisted, ${r.whitelistReused} whitelist rows already in place.`,
    );

  const onSeedExternal = () =>
    wrap(
      "External voters seeded",
      () =>
        seedExternalVoters({
          electionId: election._id,
          count: externalCount,
        }),
      (r) =>
        `${r.inserted} new external voters added, ${r.reused} reused.`,
    );

  const onSeedEvaluations = () =>
    wrap(
      "Internal evaluations seeded",
      () =>
        seedInternalEvaluations({
          electionId: election._id,
          distribution,
          submitted: submittedToggle,
        }),
      (r) =>
        `${r.evaluatorsTouched} evaluators, ${r.scoresWritten} scores, ${r.evaluationsSubmitted} submitted.`,
    );

  const onSeedVotes = () =>
    wrap(
      "Public votes seeded",
      () =>
        seedPublicVotes({
          electionId: election._id,
          totalVotesPerPosition: voteTotal,
          kind: voteKind,
        }),
      (r) =>
        `${r.positionsTouched} positions touched, ${r.votesInserted} new votes, ${r.externalVotersUsed} unique external voters used.`,
    );

  const onEngineerTie = async () => {
    if (!tiePositionId) {
      toast.error("Pick a position first.", {
        description:
          "Choose the position to engineer the tie at from the dropdown above.",
      });
      return;
    }
    await wrap(
      "Tie engineered",
      () =>
        engineerTieAtPosition({
          positionId: tiePositionId,
          votesPerTopCandidate: tiePerCandidate,
        }),
      (r) =>
        `${r.votesInserted} new votes inserted, ${r.scoresWritten} rubric scores written across ${r.topCandidateIds.length} top candidates.`,
    );
  };

  const onHappyPath = () =>
    wrap(
      "Happy path scenario complete",
      () =>
        runHappyPathScenario({
          electionId: election._id,
          perClass: {
            topCommittee: tcCount,
            headExecutive: heCount,
            year2Committee: y2Count,
          },
          externalVoters: externalCount,
          distribution,
        }),
      (r) =>
        `${r.votersInserted} evaluators added, ${r.externalInserted} external voters added, ${r.evaluationsSubmitted} evaluations submitted with ${r.distribution} distribution.`,
    );

  const onWipe = async () => {
    const ok = await dialog.confirm({
      title: "Wipe all seeded voters and votes?",
      description: (
        <>
          This deletes every <code>seed-*</code> voter, whitelist entry,
          evaluation, score, public vote, and result row scoped to{" "}
          <strong>{election.name}</strong>. Real data is untouched. Test
          candidates and their position links are kept; use &ldquo;Wipe
          everything&rdquo; below if you want a one-shot teardown. Position
          session statuses reset to <code>pending</code>.
        </>
      ),
      confirmText: "Wipe seed data",
      variant: "destructive",
    });
    if (!ok) return;
    await wrap(
      "Seed data wiped",
      () => wipeSeedData({ electionId: election._id }),
      (r) =>
        `${r.votersDeleted} voters, ${r.whitelistDeleted} whitelist rows, ${r.evaluationsDeleted} evaluations, ${r.scoresDeleted} scores, ${r.votesDeleted} votes, and ${r.resultsCleared} result rows removed; ${r.positionsReset} positions reset to pending.`,
    );
  };

  const onLoadTestCandidates = () =>
    wrap(
      "Test candidates loaded",
      () => loadTestCandidates({ electionId: election._id }),
      (r) =>
        `${r.inserted} fixture candidates inserted, ${r.skipped} already in place. Total spec: ${r.totalSpec}.`,
    );

  const onWipeTestCandidates = async () => {
    const ok = await dialog.confirm({
      title: "Wipe test candidates?",
      description: (
        <>
          This removes every <code>[TEST_FIXTURE]</code> candidate (and its
          position links) scoped to <strong>{election.name}</strong>.
          Synthetic voters, evaluations, votes, and real candidates are
          kept. You can re-load the fixture set anytime in the Setup phase.
        </>
      ),
      confirmText: "Wipe test candidates",
      variant: "destructive",
    });
    if (!ok) return;
    await wrap(
      "Test candidates wiped",
      () => wipeTestCandidates({ electionId: election._id }),
      (r) =>
        `${r.candidatesDeleted} fixture candidates removed (${r.linksDeleted} position links).`,
    );
  };

  const onWipeAll = async () => {
    const ok = await dialog.confirm({
      title: "Wipe everything seeded for this cycle?",
      description: (
        <>
          One-shot teardown: every <code>seed-*</code> voter and downstream
          row, every <code>[TEST_FIXTURE]</code> candidate, all results,
          and every position&apos;s session status reset to{" "}
          <code>pending</code>, scoped to <strong>{election.name}</strong>.
          Real voters, real whitelist rows, real candidates, the cycle
          itself, positions, and rubric criteria are all kept. Use this
          between full end-to-end runs.
        </>
      ),
      confirmText: "Wipe everything",
      variant: "destructive",
    });
    if (!ok) return;
    await wrap(
      "Test data fully wiped",
      () => wipeAll({ electionId: election._id }),
      (r) =>
        `Voters: ${r.seed.votersDeleted}, whitelist: ${r.seed.whitelistDeleted}, evals: ${r.seed.evaluationsDeleted}, scores: ${r.seed.scoresDeleted}, votes: ${r.seed.votesDeleted}, results: ${r.seed.resultsCleared}, positions reset: ${r.seed.positionsReset}, fixture candidates: ${r.candidates.candidatesDeleted} (${r.candidates.linksDeleted} links).`,
    );
  };

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />

      <header className="space-y-3">
        <SectionMarker
          primary="Dev seeder"
          secondary={election.name}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
            Synthetic data and cycle fixtures
          </h1>
          <Badge tone="warning" className="shrink-0 sm:self-start">
            <Beaker className="h-3 w-3" aria-hidden /> Dev only
          </Badge>
        </div>
        <MetaGroup className="grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          <Meta label="Cycle phase" value={PHASE_LABELS[phase]} />
          <Meta label="Positions" value={positionsCount} />
          <Meta label="Candidates" value={candidatesCount} />
          <Meta label="Dev flag" value="Enabled" />
        </MetaGroup>
      </header>

      <SeedInventory stats={stats} />

      <ScenarioRunner
        stats={stats}
        phase={phase}
        candidatesCount={candidatesCount}
        onLoadTestCandidates={onLoadTestCandidates}
        onHappyPath={onHappyPath}
      />

      <AdvancedSeedControls
        phase={phase}
        candidatesCount={candidatesCount}
        positionsCount={positionsCount}
        positions={positions}
        tcCount={tcCount}
        heCount={heCount}
        y2Count={y2Count}
        externalCount={externalCount}
        distribution={distribution}
        submittedToggle={submittedToggle}
        voteTotal={voteTotal}
        voteKind={voteKind}
        tiePositionId={tiePositionId}
        tiePerCandidate={tiePerCandidate}
        onTcCountChange={setTcCount}
        onHeCountChange={setHeCount}
        onY2CountChange={setY2Count}
        onExternalCountChange={setExternalCount}
        onDistributionChange={setDistribution}
        onSubmittedToggleChange={setSubmittedToggle}
        onVoteTotalChange={setVoteTotal}
        onVoteKindChange={setVoteKind}
        onTiePositionIdChange={setTiePositionId}
        onTiePerCandidateChange={setTiePerCandidate}
        onSeedEvaluators={onSeedEvaluators}
        onSeedExternal={onSeedExternal}
        onSeedEvaluations={onSeedEvaluations}
        onSeedVotes={onSeedVotes}
        onEngineerTie={onEngineerTie}
      />

      <DangerZone
        phase={phase}
        stats={stats}
        onWipeTestCandidates={onWipeTestCandidates}
        onWipe={onWipe}
        onWipeAll={onWipeAll}
      />
    </main>
  );
}
