"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Beaker,
  FlaskConical,
  Trash2,
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
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Distribution = "uniform" | "perfect" | "favorFirst";
type VoteTallyKind = "uniform" | "favorFirst";

const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  uniform: "Uniform random (seeded, deterministic)",
  perfect: "Perfect — all max scores",
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
      <main className="container-wide py-10 space-y-6">
        <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          title="Dev seeder disabled"
          description={
            "Set DEV_SEED_ALLOWED=\"true\" on your Convex deployment env to enable. Make sure this env var is NEVER set on production."
          }
        />
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

  const wrap = async <T,>(label: string, fn: () => Promise<T>): Promise<void> => {
    try {
      const result = await fn();
      toast.success(label, {
        description: result ? JSON.stringify(result) : undefined,
      });
    } catch (err) {
      toast.error(label, {
        description: getConvexErrorMessage(err, "Seed failed."),
      });
    }
  };

  const onSeedEvaluators = () =>
    wrap("Evaluator voters seeded", () =>
      seedEvaluatorVoters({
        electionId: election._id,
        perClass: {
          topCommittee: tcCount,
          headExecutive: heCount,
          year2Committee: y2Count,
        },
      }),
    );

  const onSeedExternal = () =>
    wrap("External voters seeded", () =>
      seedExternalVoters({
        electionId: election._id,
        count: externalCount,
      }),
    );

  const onSeedEvaluations = () =>
    wrap("Internal evaluations seeded", () =>
      seedInternalEvaluations({
        electionId: election._id,
        distribution,
        submitted: submittedToggle,
      }),
    );

  const onSeedVotes = () =>
    wrap("Public votes seeded", () =>
      seedPublicVotes({
        electionId: election._id,
        totalVotesPerPosition: voteTotal,
        kind: voteKind,
      }),
    );

  const onEngineerTie = async () => {
    if (!tiePositionId) {
      toast.error("Pick a position first.");
      return;
    }
    await wrap("Tie engineered", () =>
      engineerTieAtPosition({
        positionId: tiePositionId,
        votesPerTopCandidate: tiePerCandidate,
      }),
    );
  };

  const onHappyPath = () =>
    wrap("Happy path scenario complete", () =>
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
    );

  const onWipe = async () => {
    const ok = await dialog.confirm({
      title: "Wipe all seeded data?",
      description: (
        <>
          This deletes every <code>seed-*</code> voter, whitelist entry,
          evaluation, score, public vote, and result row scoped to{" "}
          <strong>{election.name}</strong>. Real data is untouched. Position
          session statuses also reset to <code>pending</code>.
        </>
      ),
      confirmText: "Wipe seed data",
      variant: "destructive",
    });
    if (!ok) return;
    await wrap("Seed data wiped", () =>
      wipeSeedData({ electionId: election._id }),
    );
  };

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />

      <header className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dev seeder</h1>
            <Badge tone="warning">
              <Beaker className="h-3 w-3" aria-hidden /> Dev only
            </Badge>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Populate synthetic voters, evaluations, and votes so the scoring
            math, cascade, and tie ladder can be exercised without dozens of
            real <code>@student.usm.my</code> accounts. Disabled in production.
          </p>
        </div>
        <Badge tone="muted">Phase: {phase}</Badge>
      </header>

      {stats === null ? null : stats === undefined ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seed inventory</CardTitle>
            <CardDescription>
              Election shard <code>{stats.shortElectionId}</code>. Seed-only
              counts; real entries are listed alongside for context.
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
          </CardContent>
        </Card>
      )}

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
            matrix. Idempotent — re-running with the same seed voters
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
            entries, and the cycle/positions/candidates themselves are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onWipe}>
            <Trash2 className="h-4 w-4" /> Wipe seed data
          </Button>
        </CardContent>
      </Card>
    </main>
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
