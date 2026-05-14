"use client";

import { useState } from "react";
import { useQuery } from "convex/react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AggregatePanel } from "./aggregate-panel";
import { ClassProgressPanel } from "./class-progress-panel";
import { EvaluatorLedger } from "./evaluator-ledger";
import { InternalPageSkeleton } from "./internal-skeleton";
import { MetricBand } from "./metric-band";
import {
  PHASE_LABELS,
  PHASE_TONE,
  type VoterClass,
} from "./internal-model";

export function InternalBody({ election }: { election: Doc<"elections"> }) {
  const completion = useQuery(api.internal.adminCompletionList, {
    electionId: election._id,
  });
  const aggregate = useQuery(api.internal.adminAggregate, {
    electionId: election._id,
  });

  const [activeTab, setActiveTab] = useState<VoterClass | "all">("all");
  if (completion === undefined || aggregate === undefined) {
    return <InternalPageSkeleton />;
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
    <main className="container-workbench space-y-6 py-8">
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
          </div>
        </div>

        <MetricBand
          completion={completion.length}
          submitted={submittedCount}
          draft={draftCount}
          notStarted={notStartedCount}
        />
      </header>

      <section
        aria-label="Evaluator completion tracking"
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,390px)]"
      >
        <EvaluatorLedger
          rows={filteredCompletion}
          activeTab={activeTab}
          counts={countsByClass}
          total={completion.length}
          onFilterChange={setActiveTab}
          title="Evaluator completion ledger"
          description={`${filteredCompletion.length} visible`}
        />
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <ClassProgressPanel
            aggregate={aggregate}
            countsByClass={countsByClass}
            classWeightLookup={classWeightLookup}
          />
        </aside>
      </section>

      <AggregatePanel aggregate={aggregate} activeTab={activeTab} />
    </main>
  );
}
