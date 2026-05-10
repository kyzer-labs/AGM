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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMYT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

const VOTER_CLASS_TONE: Record<VoterClass, "brand" | "copper" | "muted"> = {
  topCommittee: "brand",
  headExecutive: "copper",
  year2Committee: "muted",
};

const VOTER_CLASSES: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

type Phase = Doc<"elections">["phase"];

const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const PHASE_TONE: Record<
  Phase,
  "brand" | "success" | "warning" | "muted" | "copper"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "muted",
  publicVoting: "brand",
  resultsPreview: "copper",
  published: "success",
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
  if (election === undefined) return <PageSkeleton />;
  if (election === null) return <NoElection />;
  return <Body election={election} />;
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
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
    return <PageSkeleton />;
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

  const countsByClass: Record<VoterClass, number> = {
    topCommittee: 0,
    headExecutive: 0,
    year2Committee: 0,
  };
  for (const row of completion) countsByClass[row.voterClass] += 1;

  return (
    <main className="container-wide space-y-12 py-12">
      <AdminBreadcrumb items={[{ label: "Internal evaluation" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Internal evaluation"
          secondary={election.name}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Class-aware completion and aggregate scores
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Tracks which Year 2 evaluators have submitted, broken down by
          class. Class shares feed the weighted final score; drafts are
          ignored until the evaluator submits. Open or close the internal
          window from the{" "}
          <LinkButton
            href="/admin/election"
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
          >
            Election cycle
          </LinkButton>{" "}
          page.
        </p>
        <MetaGroup className="grid-cols-2 sm:grid-cols-4">
          <Meta label="Cycle phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="On whitelist" value={completion.length} />
          <Meta label="Submitted" value={submittedCount} />
          <Meta label="Pending" value={draftCount + notStartedCount} />
        </MetaGroup>
        <div>
          <Badge tone={PHASE_TONE[election.phase]}>
            {PHASE_LABELS[election.phase]}
          </Badge>
        </div>
      </header>

      <section
        aria-label="Submission status counts"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Stat
          label="Submitted"
          value={submittedCount}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          hint="Counted in the weighted aggregate."
        />
        <Stat
          label="Draft only"
          value={draftCount}
          tone="warning"
          icon={<PenLine className="h-4 w-4" aria-hidden />}
          hint="Saved but not submitted; not in the aggregate."
        />
        <Stat
          label="Not started"
          value={notStartedCount}
          tone="muted"
          icon={<Circle className="h-4 w-4" aria-hidden />}
          hint="No draft yet, or evaluator has not signed in."
        />
      </section>

      <section
        aria-label="Class submission progress"
        className="grid gap-3 sm:grid-cols-3"
      >
        {VOTER_CLASSES.map((cls) => {
          const submitted =
            aggregate.evaluatorsByClass.find((r) => r.voterClass === cls)
              ?.submitted ?? 0;
          const total = countsByClass[cls];
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

      <section
        aria-label="Whitelist completion"
        className="space-y-4"
      >
        <header className="flex flex-wrap items-center gap-3">
          <SectionMarker
            primary="Whitelist completion"
            secondary={`${completion.length} ${completion.length === 1 ? "evaluator" : "evaluators"}`}
          />
          <FilterChips
            current={activeTab}
            counts={countsByClass}
            total={completion.length}
            onChange={setActiveTab}
          />
        </header>
        <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Per-evaluator status. Voters who have not signed in yet show as
          <em> Not signed in</em>; their evaluation status falls back to
          <em> Not started</em>.
        </p>

        {filteredCompletion.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden />}
            title={
              activeTab === "all"
                ? "Whitelist is empty"
                : `No evaluators in ${VOTER_CLASS_LABEL[activeTab]}`
            }
            description={
              activeTab === "all"
                ? "Internal evaluation cannot start until at least one evaluator is on the whitelist. Add them on the Whitelist page."
                : "Add evaluators with this class on the Whitelist page, or change the filter above to All classes."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
                  <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                    Email
                  </th>
                  <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                    Class
                  </th>
                  <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                    Name
                  </th>
                  <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                    Status
                  </th>
                  <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                    Last update (MYT)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompletion.map((row) => (
                  <tr
                    key={row.email}
                    className="border-b border-[var(--ink-line)] last:border-b-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--ink)]">
                      {row.email}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={VOTER_CLASS_TONE[row.voterClass]}>
                        {VOTER_CLASS_LABEL[row.voterClass]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-[var(--ink)]">
                      {row.fullName ?? (
                        <span className="italic text-[var(--ink-muted)]">
                          Not signed in
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                      {row.submittedAt
                        ? `Submitted ${formatMYT(row.submittedAt)}`
                        : row.updatedAt
                          ? formatMYT(row.updatedAt)
                          : "Not yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Aggregate scores by class" className="space-y-4">
        <header className="space-y-2">
          <SectionMarker
            primary="Aggregate scores"
            secondary="Submitted only"
          />
          <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl">
            <ClipboardCheck
              className="mr-2 inline-block h-5 w-5 text-[var(--ink-muted)]"
              aria-hidden
            />
            Class share by candidate
          </h2>
          <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Sum of totals share per class. Drafts are not counted. The
            class share is the candidate&apos;s rubric total divided by
            the total awarded by every submitted evaluator of that class.
          </p>
        </header>
        {aggregate.candidates.length === 0 ||
        aggregate.criteria.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
            title="No data yet"
            description="Add candidates and configure rubric criteria first. Once internal evaluators submit, this table fills in."
          />
        ) : (
          <ClassAggregateTable aggregate={aggregate} activeTab={activeTab} />
        )}
      </section>
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
    <div className="space-y-8">
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
          <div key={cls} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <Badge tone={VOTER_CLASS_TONE[cls]}>
                {VOTER_CLASS_LABEL[cls]}
              </Badge>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                weight{" "}
                <span className="tabular-nums">{weight}%</span>
                <span aria-hidden className="px-1 text-[var(--copper)]">
                  ·
                </span>
                <span className="tabular-nums">{evaluators}</span> submitted
                <span aria-hidden className="px-1 text-[var(--copper)]">
                  ·
                </span>
                <span className="tabular-nums">{grandTotal}</span> total points
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
                    <th className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Candidate
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Evaluators
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Sum
                    </th>
                    {aggregate.criteria.map((cr) => (
                      <th
                        key={cr._id}
                        className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)] whitespace-nowrap"
                      >
                        {cr.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium text-[var(--ink-muted)]">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidateRows.map((row) => (
                    <tr
                      key={row.candidateId}
                      className="border-b border-[var(--ink-line)] last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--ink)]">
                          {row.fullName}
                        </div>
                        {row.matric && !row.matric.startsWith("auto-") ? (
                          <div className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
                            {row.matric}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.evaluatorCount}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink)]">
                        {row.totalSum}
                      </td>
                      {aggregate.criteria.map((cr) => {
                        const cell = row.perCriterion.find(
                          (p) => p.criterionId === cr._id,
                        );
                        return (
                          <td
                            key={cr._id}
                            className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ink-muted)]"
                          >
                            {cell && cell.count > 0
                              ? cell.average.toFixed(2)
                              : "-"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-[var(--ink)]">
                        {(row.share * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    <div className="space-y-2 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4">
      <div className="flex items-center justify-between">
        <Badge tone={VOTER_CLASS_TONE[voterClass]}>
          {VOTER_CLASS_LABEL[voterClass]}
        </Badge>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {weight}% weight
        </span>
      </div>
      <div className="font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
        {submitted}
        <span className="text-base font-normal text-[var(--ink-muted)]">
          {" "}
          / {total}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${VOTER_CLASS_LABEL[voterClass]} submission progress`}
      >
        <div
          className="h-full bg-[var(--copper)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
        {pct}% submitted
      </div>
    </div>
  );
}

function FilterChips({
  current,
  counts,
  total,
  onChange,
}: {
  current: VoterClass | "all";
  counts: Record<VoterClass, number>;
  total: number;
  onChange: (cls: VoterClass | "all") => void;
}) {
  const chips: { value: VoterClass | "all"; label: string; count: number }[] =
    [
      { value: "all", label: "All classes", count: total },
      {
        value: "topCommittee",
        label: VOTER_CLASS_LABEL.topCommittee,
        count: counts.topCommittee,
      },
      {
        value: "headExecutive",
        label: VOTER_CLASS_LABEL.headExecutive,
        count: counts.headExecutive,
      },
      {
        value: "year2Committee",
        label: VOTER_CLASS_LABEL.year2Committee,
        count: counts.year2Committee,
      },
    ];
  return (
    <div
      role="radiogroup"
      aria-label="Filter by class"
      className="flex flex-wrap items-center gap-1.5"
    >
      {chips.map((c) => {
        const active = current === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em]",
              active
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                : "border-[var(--ink-line)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
            )}
          >
            <span>{c.label}</span>
            <span className="tabular-nums">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
  icon: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {label}
        </span>
        <Badge tone={tone}>{icon}</Badge>
      </div>
      <div className="font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
        {value}
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
        {hint}
      </p>
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
