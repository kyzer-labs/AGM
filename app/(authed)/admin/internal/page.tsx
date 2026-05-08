"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  PenLine,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

const VOTER_CLASS_TONE: Record<VoterClass, "brand" | "warning" | "muted"> = {
  topCommittee: "brand",
  headExecutive: "warning",
  year2Committee: "muted",
};

const VOTER_CLASSES: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

const PHASE_LABELS: Record<string, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation OPEN",
  internalClosed: "Internal evaluation CLOSED",
  publicVoting: "Public voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export default function AdminInternalPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined)
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  if (election === null) return <NoElection />;
  return <Body election={election} />;
}

function Body({ election }: { election: Doc<"elections"> }) {
  const completion = useQuery(api.internal.adminCompletionList, {
    electionId: election._id,
  });
  const aggregate = useQuery(api.internal.adminAggregate, {
    electionId: election._id,
  });

  const [activeTab, setActiveTab] = useState<VoterClass | "all">("all");

  if (completion === undefined || aggregate === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const submittedCount = completion.filter(
    (c) => c.status === "submitted",
  ).length;
  const draftCount = completion.filter((c) => c.status === "draft").length;
  const notStartedCount = completion.filter(
    (c) => c.status === "notStarted",
  ).length;

  const classWeightLookup = new Map(
    aggregate.evaluatorsByClass.map(
      (row) => [row.voterClass as VoterClass, row.weight] as const,
    ),
  );

  const filteredCompletion =
    activeTab === "all"
      ? completion
      : completion.filter((c) => c.voterClass === activeTab);

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Internal evaluation" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Internal evaluation
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Class-aware completion + aggregate scores for{" "}
            <strong>{election.name}</strong>. Open or close the internal
            window from the{" "}
            <a className="underline" href="/admin/election">
              Election cycle
            </a>{" "}
            page.
          </p>
        </div>
        <Badge
          tone={
            election.phase === "internalOpen"
              ? "brand"
              : election.phase === "internalClosed" ||
                  election.phase === "publicVoting" ||
                  election.phase === "resultsPreview" ||
                  election.phase === "published"
                ? "success"
                : "muted"
          }
        >
          {PHASE_LABELS[election.phase] ?? election.phase}
        </Badge>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Submitted"
          value={String(submittedCount)}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
        />
        <Stat
          label="Draft only"
          value={String(draftCount)}
          tone="warning"
          icon={<PenLine className="h-4 w-4" aria-hidden />}
        />
        <Stat
          label="Not started"
          value={String(notStartedCount)}
          tone="muted"
          icon={<Circle className="h-4 w-4" aria-hidden />}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {VOTER_CLASSES.map((cls) => {
          const submitted = aggregate.evaluatorsByClass.find(
            (r) => r.voterClass === cls,
          )?.submitted ?? 0;
          const total = completion.filter((r) => r.voterClass === cls).length;
          const weight = classWeightLookup.get(cls) ?? 0;
          const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
          return (
            <ClassStatCard
              key={cls}
              voterClass={cls}
              submitted={submitted}
              total={total}
              weight={weight}
              pct={pct}
            />
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden />
              Whitelist completion
            </CardTitle>
            <div className="flex-1" />
            <div className="flex flex-wrap items-center gap-1">
              <TabPill
                label="All"
                active={activeTab === "all"}
                onClick={() => setActiveTab("all")}
                count={completion.length}
              />
              {VOTER_CLASSES.map((cls) => (
                <TabPill
                  key={cls}
                  label={VOTER_CLASS_LABEL[cls]}
                  active={activeTab === cls}
                  onClick={() => setActiveTab(cls)}
                  count={completion.filter((c) => c.voterClass === cls).length}
                />
              ))}
            </div>
          </div>
          <CardDescription>
            Per-evaluator status. Voters who haven&apos;t signed in yet show
            as &quot;Not signed in&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCompletion.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="Whitelist is empty"
              description="Add evaluators on the Whitelist page first."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompletion.map((row) => (
                    <tr key={row.email} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">
                        <Badge tone={VOTER_CLASS_TONE[row.voterClass]}>
                          {VOTER_CLASS_LABEL[row.voterClass]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                        {row.fullName ?? (
                          <span className="italic">Not signed in</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                        {row.submittedAt
                          ? `Submitted ${new Date(row.submittedAt).toLocaleString()}`
                          : row.updatedAt
                            ? new Date(row.updatedAt).toLocaleString()
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Aggregate scores by class (submitted only)
          </CardTitle>
          <CardDescription>
            Sum-of-totals share per class. Drafts are not counted. The class
            share is the candidate&apos;s rubric total divided by the total
            awarded by all evaluators of that class.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {aggregate.candidates.length === 0 ||
          aggregate.criteria.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
              title="No data yet"
              description="Add candidates and configure rubric criteria first."
            />
          ) : (
            <ClassAggregateTable aggregate={aggregate} activeTab={activeTab} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function ClassAggregateTable({
  aggregate,
  activeTab,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  activeTab: VoterClass | "all";
}) {
  const visibleClasses: VoterClass[] =
    activeTab === "all" ? VOTER_CLASSES : [activeTab];

  const grandTotalsByClass = useMemo(() => {
    const totals: Record<VoterClass, number> = {
      topCommittee: 0,
      headExecutive: 0,
      year2Committee: 0,
    };
    for (const c of aggregate.candidates) {
      for (const cls of c.byClass) {
        totals[cls.voterClass as VoterClass] += cls.totalSum;
      }
    }
    return totals;
  }, [aggregate]);

  return (
    <div className="space-y-6 p-4">
      {visibleClasses.map((cls) => {
        const grandTotal = grandTotalsByClass[cls];
        const weight =
          aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
            ?.weight ?? 0;
        const evaluators =
          aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
            ?.submitted ?? 0;
        const candidateRows = aggregate.candidates
          .map((c) => {
            const byCls = c.byClass.find((b) => b.voterClass === cls);
            const sum = byCls?.totalSum ?? 0;
            const share = grandTotal > 0 ? sum / grandTotal : 0;
            return {
              candidateId: c.candidateId,
              fullName: c.fullName,
              matric: c.matric,
              evaluatorCount: byCls?.evaluatorCount ?? 0,
              totalSum: sum,
              share,
              perCriterion: byCls?.perCriterion ?? [],
            };
          })
          .sort((a, b) => b.share - a.share);

        return (
          <div key={cls} className="overflow-x-auto">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={VOTER_CLASS_TONE[cls]}>
                {VOTER_CLASS_LABEL[cls]}
              </Badge>
              <span className="text-[var(--color-muted-foreground)]">
                weight {weight}% · {evaluators} submitted ·{" "}
                {grandTotal} total points
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                  <th className="px-3 py-2 font-medium">Candidate</th>
                  <th className="px-3 py-2 font-medium text-right">N</th>
                  <th className="px-3 py-2 font-medium text-right">Sum</th>
                  {aggregate.criteria.map((cr) => (
                    <th
                      key={cr._id}
                      className="px-3 py-2 font-medium text-right whitespace-nowrap"
                    >
                      {cr.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {candidateRows.map((row) => (
                  <tr
                    key={row.candidateId}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.fullName}</div>
                      {row.matric && !row.matric.startsWith("auto-") ? (
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          {row.matric}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.evaluatorCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.totalSum}
                    </td>
                    {aggregate.criteria.map((cr) => {
                      const cell = row.perCriterion.find(
                        (p) => p.criterionId === cr._id,
                      );
                      return (
                        <td
                          key={cr._id}
                          className="px-3 py-2 text-right tabular-nums"
                        >
                          {cell && cell.count > 0
                            ? cell.average.toFixed(2)
                            : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {(row.share * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function ClassStatCard({
  voterClass,
  submitted,
  total,
  weight,
  pct,
}: {
  voterClass: VoterClass;
  submitted: number;
  total: number;
  weight: number;
  pct: number;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Badge tone={VOTER_CLASS_TONE[voterClass]}>
          {VOTER_CLASS_LABEL[voterClass]}
        </Badge>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {weight}% weight
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {submitted}
        <span className="text-base font-normal text-[var(--color-muted-foreground)]">
          {" "}
          / {total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full bg-[var(--color-primary)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {pct}% submitted
      </div>
    </div>
  );
}

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "hover:bg-[var(--color-muted)]",
      )}
    >
      {label}{" "}
      <span
        className={cn(
          active
            ? "text-[var(--color-primary-foreground)]/70"
            : "text-[var(--color-muted-foreground)]",
        )}
      >
        ({count})
      </span>
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "muted";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {label}
        </span>
        <Badge tone={tone}>{icon}</Badge>
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "submitted")
    return (
      <Badge tone="success">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Submitted
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge tone="warning">
        <PenLine className="h-3 w-3" aria-hidden /> Draft
      </Badge>
    );
  return (
    <Badge tone="muted">
      <Circle className="h-3 w-3" aria-hidden /> Not started
    </Badge>
  );
}
