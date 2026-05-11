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
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMYT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";
type LayoutVariant = "matrix" | "split";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
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
  const [layoutVariant, setLayoutVariant] =
    useState<LayoutVariant>("split");

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

  const phaseBadge = (
    <Badge tone={PHASE_TONE[election.phase]}>{PHASE_LABELS[election.phase]}</Badge>
  );

  return (
    <main className="mx-auto w-full max-w-[min(110rem,calc(100vw-2rem))] space-y-4 px-4 py-8">
      <header className="space-y-4 border-b border-[var(--ink-line)] pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <AdminBreadcrumb items={[{ label: "Internal evaluation" }]} />
            <SectionMarker primary="Internal evaluation" secondary={election.name} />
            <h1 className="font-display text-2xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-3xl">
              Internal evaluation register
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phaseBadge}
            <LayoutToggle value={layoutVariant} onChange={setLayoutVariant} />
          </div>
        </div>

        <MetricBand
          completion={completion.length}
          submitted={submittedCount}
          draft={draftCount}
          notStarted={notStartedCount}
        />
      </header>

      {layoutVariant === "matrix" ? (
        <section
          aria-label="Probe 4 ledger-first matrix"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(330px,390px)]"
        >
          <EvaluatorLedger
            rows={filteredCompletion}
            activeTab={activeTab}
            counts={countsByClass}
            total={completion.length}
            onFilterChange={setActiveTab}
            title="Evaluator status"
            description={`${filteredCompletion.length} visible`}
          />
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <ClassProgressPanel
              aggregate={aggregate}
              countsByClass={countsByClass}
              classWeightLookup={classWeightLookup}
            />
            <AggregatePanel aggregate={aggregate} activeTab={activeTab} />
          </aside>
        </section>
      ) : (
        <section
          aria-label="Probe 5 split-pane register"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]"
        >
          <EvaluatorLedger
            rows={filteredCompletion}
            activeTab={activeTab}
            counts={countsByClass}
            total={completion.length}
            onFilterChange={setActiveTab}
            title="Evaluator completion ledger"
            description={`${completion.length} whitelisted`}
            dense
          />
          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4">
              <SectionMarker primary="Control rail" secondary="Class filter" />
              <div className="mt-4">
                <FilterChips
                  current={activeTab}
                  counts={countsByClass}
                  total={completion.length}
                  onChange={setActiveTab}
                />
              </div>
            </section>
            <ClassProgressPanel
              aggregate={aggregate}
              countsByClass={countsByClass}
              classWeightLookup={classWeightLookup}
            />
            <AggregatePanel aggregate={aggregate} activeTab={activeTab} />
          </div>
        </section>
      )}
    </main>
  );
}

function LayoutToggle({
  value,
  onChange,
}: {
  value: LayoutVariant;
  onChange: (value: LayoutVariant) => void;
}) {
  const options: { value: LayoutVariant; label: string }[] = [
    { value: "split", label: "Split register" },
    { value: "matrix", label: "Matrix view" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Layout variant"
      className="inline-flex border border-[var(--ink-line)] bg-[var(--paper)]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "border-r border-[var(--ink-line)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
              active
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] text-[var(--ink-muted)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricBand({
  completion,
  submitted,
  draft,
  notStarted,
}: {
  completion: number;
  submitted: number;
  draft: number;
  notStarted: number;
}) {
  const metrics = [
    { label: "Whitelist", value: completion, icon: Users },
    { label: "Submitted", value: submitted, icon: CheckCircle2 },
    { label: "Draft", value: draft, icon: PenLine },
    { label: "Not started", value: notStarted, icon: Circle },
  ];

  return (
    <section
      aria-label="Internal evaluation metrics"
      className="grid overflow-hidden rounded-md border border-[var(--ink-line)] bg-[var(--paper)] sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map(({ label, value, icon: Icon }, index) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            index > 0
              ? "border-t border-[var(--ink-line)] sm:border-l sm:border-t-0"
              : "",
            index === 2 ? "xl:border-l" : "",
          )}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              {label}
            </div>
            <div className="mt-1 font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
              {value}
            </div>
          </div>
          <Icon className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
        </div>
      ))}
    </section>
  );
}

function EvaluatorLedger({
  rows,
  activeTab,
  counts,
  total,
  onFilterChange,
  title,
  description,
  dense = false,
}: {
  rows: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminCompletionList>>>;
  activeTab: VoterClass | "all";
  counts: Record<VoterClass, number>;
  total: number;
  onFilterChange: (cls: VoterClass | "all") => void;
  title: string;
  description: string;
  dense?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-md border border-[var(--ink-line)] bg-[var(--paper)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ink-line)] bg-[var(--paper-2)] px-4 py-3">
        <SectionMarker primary={title} secondary={description} />
        {!dense ? (
          <FilterChips
            current={activeTab}
            counts={counts}
            total={total}
            onChange={onFilterChange}
          />
        ) : null}
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title={
            activeTab === "all"
              ? "Whitelist is empty"
              : `No evaluators in ${VOTER_CLASS_LABEL[activeTab]}`
          }
          description={
            activeTab === "all"
              ? "Add internal evaluators on the Whitelist page before opening evaluation."
              : "Change the class filter or add evaluators in this class from the Whitelist page."
          }
        />
      ) : (
        <div
          className={cn(
            "overflow-auto",
            dense ? "max-h-[calc(100dvh-15rem)]" : "max-h-[calc(100dvh-19rem)]",
          )}
        >
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--ink-line)] bg-[var(--paper-2)] text-left">
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Evaluator
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Class
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Status
                </th>
                <th className="px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Last update (MYT)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.email}
                  className="border-b border-[var(--ink-line)] last:border-b-0"
                >
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs tabular-nums text-[var(--ink)]">
                      {row.email}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {row.fullName ?? "Not signed in"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ClassLabel voterClass={row.voterClass} />
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
  );
}

function ClassProgressPanel({
  aggregate,
  countsByClass,
  classWeightLookup,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  countsByClass: Record<VoterClass, number>;
  classWeightLookup: Map<VoterClass, number>;
}) {
  return (
    <section aria-label="Class submission progress" className="space-y-3">
      <SectionMarker primary="Class progress" secondary="Weighted evaluator groups" />
      <div className="grid gap-3">
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
      </div>
    </section>
  );
}

function AggregatePanel({
  aggregate,
  activeTab,
}: {
  aggregate: NonNullable<ReturnType<typeof useQuery<typeof api.internal.adminAggregate>>>;
  activeTab: VoterClass | "all";
}) {
  return (
    <section
      aria-label="Aggregate scores by class"
      className="space-y-3 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionMarker primary="Aggregate scores" secondary="Submitted only" />
        <ClipboardCheck className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden />
      </div>
      {aggregate.candidates.length === 0 || aggregate.criteria.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
          title="No data yet"
          description="Add candidates and configure rubric criteria first. Once internal evaluators submit, this table fills in."
        />
      ) : (
        <ClassAggregateTable aggregate={aggregate} activeTab={activeTab} />
      )}
    </section>
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
              <ClassLabel voterClass={cls} />
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
        <ClassLabel voterClass={voterClass} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {weight}% weight
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="font-display text-2xl font-medium tabular-nums text-[var(--ink)]">
          {submitted}
          <span className="text-base font-normal text-[var(--ink-muted)]">
            {" "}
            / {total}
          </span>
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
          {pct}%
        </div>
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
      className="inline-flex flex-wrap border border-[var(--ink-line)] bg-[var(--paper)]"
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
              "inline-flex items-center gap-2 border-r border-[var(--ink-line)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
              active
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] text-[var(--ink-muted)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
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

function ClassLabel({ voterClass }: { voterClass: VoterClass }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink)]">
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-[2px]",
          voterClass === "topCommittee"
            ? "bg-[var(--teal)]"
            : voterClass === "headExecutive"
              ? "bg-[var(--copper)]"
              : "bg-[var(--ink-muted)]",
        )}
      />
      {VOTER_CLASS_LABEL[voterClass]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "submitted")
    return (
      <Badge tone="success" className="rounded-[3px]">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Submitted
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge tone="warning" className="rounded-[3px]">
        <PenLine className="h-3 w-3" aria-hidden /> Draft
      </Badge>
    );
  return (
    <Badge tone="muted" className="rounded-[3px]">
      <Circle className="h-3 w-3" aria-hidden /> Not started
    </Badge>
  );
}
