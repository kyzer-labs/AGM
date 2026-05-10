"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Beaker,
  CheckCircle2,
  Circle,
  FlaskConical,
  Flame,
  PlayCircle,
  Trash2,
  Users2,
  Wand2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Distribution = "uniform" | "perfect" | "favorFirst";
type VoteTallyKind = "uniform" | "favorFirst";

const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  uniform: "Uniform random (seeded, deterministic)",
  perfect: "Perfect: all max scores",
  favorFirst: "Favor first candidate (high vs low)",
};

const TALLY_LABEL: Record<VoteTallyKind, string> = {
  uniform: "Even split",
  favorFirst: "Favor first candidate (~70%)",
};

export default function DevSeedPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const config = useQuery(api.dev.config);
  const election = useQuery(api.elections.getCurrent);

  if (config === undefined || election === undefined) {
    return (
      <main className="container-wide py-10 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }
  if (!config.enabled) {
    return (
      <main className="container-wide space-y-8 py-12">
        <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />
        <NoticeStrip
          markerPrimary="Dev seeder"
          markerSecondary="Disabled"
          markerIcon={
            <AlertTriangle
              className="h-4 w-4 text-[var(--copper)]"
              aria-hidden
            />
          }
          headline="DEV_SEED_ALLOWED is not set on this deployment"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Set <code>DEV_SEED_ALLOWED=&quot;true&quot;</code> on the
            Convex deployment env to enable synthetic voters,
            evaluations, and votes for end-to-end testing. This env var
            must <strong className="font-semibold">never</strong> be set
            on the production deployment; the seeder is gated server-side
            so even an authenticated admin cannot insert seed rows when
            the flag is absent.
          </p>
        </NoticeStrip>
      </main>
    );
  }
  if (election === null) return <NoElection />;
  return <DevBody election={election} />;
}

function DevBody({ election }: { election: Doc<"elections"> }) {
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
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Dev seeder"
          secondary={election.name}
        />
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
            Synthetic data for end-to-end testing
          </h1>
          <Badge tone="warning">
            <Beaker className="h-3 w-3" aria-hidden /> Dev only
          </Badge>
        </div>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Populate synthetic voters, evaluations, and votes so the scoring
          math, cascade, and tie ladder can be exercised without dozens of
          real <code>@student.usm.my</code> accounts. Every seed mutation
          checks <code>DEV_SEED_ALLOWED</code> server-side; this page is
          gated behind the same flag.
        </p>
        <div>
          <Badge tone="muted">
            Phase: <span className="tabular-nums">{phase}</span>
          </Badge>
        </div>
      </header>

      {stats === null ? null : stats === undefined ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seed inventory</CardTitle>
              <CardDescription>
                Election shard <code>{stats.shortElectionId}</code>. Live
                snapshot of synthetic vs. real rows. Updates as you act.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                title="Seed voters"
                value={stats.seedVoters}
                footer={`Real voters: ${stats.totalRealVoters}`}
              />
              <Stat
                title="Seed whitelist"
                value={
                  stats.seedWhitelistByClass.topCommittee +
                  stats.seedWhitelistByClass.headExecutive +
                  stats.seedWhitelistByClass.year2Committee
                }
                footer={`TC ${stats.seedWhitelistByClass.topCommittee} · HE ${stats.seedWhitelistByClass.headExecutive} · Y2 ${stats.seedWhitelistByClass.year2Committee} · real ${stats.realWhitelist}`}
              />
              <Stat
                title="Seed evaluations"
                value={stats.seedEvaluationsSubmitted}
                footer={`Drafts: ${stats.seedEvaluationsTotal - stats.seedEvaluationsSubmitted}`}
              />
              <Stat
                title="Seed public votes"
                value={stats.seedPublicVotes}
                footer={`All position votes: ${stats.totalPublicVotes}`}
              />
              <Stat
                title="Test candidates"
                value={stats.candidates.test}
                footer={`Real candidates: ${stats.candidates.real} · positions: ${stats.positions}`}
              />
              <Stat
                title="Position sessions"
                value={
                  stats.sessionCounts.pending +
                  stats.sessionCounts.active +
                  stats.sessionCounts.closed
                }
                footer={`Pending ${stats.sessionCounts.pending} · Active ${stats.sessionCounts.active} · Closed ${stats.sessionCounts.closed}`}
              />
              <Stat
                title="Results computed"
                value={stats.results}
                footer={`After all positions close, this matches ${stats.positions}.`}
              />
              <Stat
                title="Cycle phase"
                value={
                  ({
                    setup: 1,
                    internalOpen: 2,
                    internalClosed: 3,
                    publicVoting: 4,
                    resultsPreview: 5,
                    published: 6,
                  } as const)[phase]
                }
                footer={`Phase: ${phase}`}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test candidate fixtures</CardTitle>
          <CardDescription>
            Load eighteen <code>[TEST_FIXTURE]</code> candidates (two per
            position across all three tiers) so the rubric, ballot ops, and
            tie-break ladder can be exercised without typing real names. Only
            available during the Setup phase. Wipes here remove only fixtures;
            real candidates entered through{" "}
            <code>/admin/candidates</code> are never touched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onLoadTestCandidates}
              disabled={phase !== "setup"}
            >
              <Users2 className="h-4 w-4" /> Load test candidates
            </Button>
            <Button
              variant="outline"
              onClick={onWipeTestCandidates}
              disabled={phase === "published" || stats?.candidates.test === 0}
            >
              <Trash2 className="h-4 w-4" /> Wipe test candidates
            </Button>
            {stats !== undefined && stats !== null ? (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                Currently {stats.candidates.test} of {18} fixtures loaded
              </span>
            ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase quick-jump</CardTitle>
          <CardDescription>
            Where to go to drive the cycle through each phase. Open these
            in another tab and watch this page&apos;s inventory update live.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <PhaseLink
            href="/admin/election"
            label="Cycle controls"
            hint="Open / close internal evaluation, advance to public voting, publish."
          />
          <PhaseLink
            href="/admin/positions"
            label="Positions"
            hint="Seed defaults, ballot order, rubric weights."
          />
          <PhaseLink
            href="/admin/candidates"
            label="Candidates"
            hint="Add real candidates here. Test candidates load via this page only."
          />
          <PhaseLink
            href="/admin/whitelist"
            label="Internal whitelist"
            hint="Real evaluators are added here. Seed evaluators are added via this page."
          />
          <PhaseLink
            href="/admin/internal"
            label="Internal status"
            hint="Watch class submission progress and aggregate scores live."
          />
          <PhaseLink
            href="/admin/public"
            label="Live ballot ops"
            hint="Open / monitor / close each position one at a time."
          />
          <PhaseLink
            href="/admin/results"
            label="Results"
            hint="Compute, resolve ties, publish the final breakdown."
          />
          <PhaseLink
            href="/admin/exports"
            label="Exports"
            hint="CSV downloads of voters, evaluations, and the audit log."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voter pools</CardTitle>
          <CardDescription>
            Internal evaluators are added to the whitelist with a class.
            External voters are not whitelisted and are drawn from when
            seeding public votes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Top Committee"
              value={tcCount}
              onChange={setTcCount}
            />
            <NumberField
              label="Head Executive"
              value={heCount}
              onChange={setHeCount}
            />
            <NumberField
              label="Year 2 Committee"
              value={y2Count}
              onChange={setY2Count}
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
              label="External voters (must be ≥ votes per position)"
              value={externalCount}
              onChange={setExternalCount}
            />
            <Button onClick={onSeedExternal}>
              <Sparkles className="h-4 w-4" /> Seed external voters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
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
              onChange={(e) => setDistribution(e.target.value as Distribution)}
            >
              {(Object.keys(DISTRIBUTION_LABEL) as Distribution[]).map((k) => (
                <option key={k} value={k}>
                  {DISTRIBUTION_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sub">Mark as</Label>
            <Select
              id="sub"
              value={submittedToggle ? "submitted" : "draft"}
              onChange={(e) =>
                setSubmittedToggle(e.target.value === "submitted")
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

      <Card>
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
            onChange={setVoteTotal}
            className="sm:flex-1"
          />
          <div className="grid gap-1.5 sm:flex-1">
            <Label htmlFor="tally">Tally shape</Label>
            <Select
              id="tally"
              value={voteKind}
              onChange={(e) => setVoteKind(e.target.value as VoteTallyKind)}
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

      <Card>
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
                setTiePositionId(e.target.value as Id<"positions"> | "")
              }
            >
              <option value="">Select position…</option>
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
            onChange={setTiePerCandidate}
          />
          <Button onClick={onEngineerTie} disabled={!tiePositionId}>
            <Wand2 className="h-4 w-4" /> Engineer tie
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Happy path scenario</CardTitle>
          <CardDescription>
            One-shot: seed evaluators in all three classes, seed external
            voters, write submitted evaluations using the chosen
            distribution. Run this in <code>setup</code> or{" "}
            <code>internalOpen</code> to skip ahead to &ldquo;ready to open
            public voting&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={onHappyPath}
            disabled={
              candidatesCount === 0 ||
              (phase !== "setup" && phase !== "internalOpen")
            }
          >
            <Sparkles className="h-4 w-4" /> Run happy path scenario
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[var(--color-destructive)]">
        <CardHeader>
          <CardTitle className="text-base">Wipe seed data</CardTitle>
          <CardDescription>
            Removes every <code>seed-*</code> row scoped to this cycle plus
            existing result rows, and resets every position&apos;s session
            status to <code>pending</code>. Real voter rows, real whitelist
            entries, real candidates, and{" "}
            <code>[TEST_FIXTURE]</code> candidates are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onWipe}>
            <Trash2 className="h-4 w-4" /> Wipe seed data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[var(--color-destructive)]">
        <CardHeader>
          <CardTitle className="text-base">Wipe everything</CardTitle>
          <CardDescription>
            One-shot teardown for the entire test setup: every{" "}
            <code>seed-*</code> voter and downstream row, every{" "}
            <code>[TEST_FIXTURE]</code> candidate, all results, and every
            position session reset to <code>pending</code>. Real data is
            untouched. Use this between full end-to-end runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onWipeAll}>
            <Flame className="h-4 w-4" /> Wipe everything
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function SessionBadge({
  status,
}: {
  status: "pending" | "active" | "closed";
}) {
  if (status === "active") {
    return (
      <Badge tone="brand" className="text-[9px]">
        <PlayCircle className="h-2.5 w-2.5" aria-hidden /> Active
      </Badge>
    );
  }
  if (status === "closed") {
    return (
      <Badge tone="success" className="text-[9px]">
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> Closed
      </Badge>
    );
  }
  return (
    <Badge tone="muted" className="text-[9px]">
      <Circle className="h-2.5 w-2.5" aria-hidden /> Pending
    </Badge>
  );
}

function PhaseLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <a
      href={href}
      className="group block rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-3 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <div className="font-medium text-[var(--ink)] transition-colors group-hover:text-[var(--teal)]">
        {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        {hint}
      </p>
    </a>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

function Stat({
  title,
  value,
  footer,
}: {
  title: string;
  value: number;
  footer: string;
}) {
  return (
    <div className="rounded-lg border bg-[var(--color-card)] p-4">
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {footer}
      </div>
    </div>
  );
}
