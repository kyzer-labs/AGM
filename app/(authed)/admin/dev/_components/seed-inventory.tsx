import type { useQuery } from "convex/react";

import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import type { api } from "@/convex/_generated/api";
import { Stat } from "./stat";

type DevStats = ReturnType<typeof useQuery<typeof api.dev.stats>>;

export function SeedInventory({ stats }: { stats: DevStats }) {
  if (stats === null) return null;
  if (stats === undefined) return <Skeleton className="h-32 w-full" />;

  return (
    <section aria-label="Seed inventory">
      <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SectionMarker
            primary="Seed inventory"
            secondary={stats.shortElectionId}
          />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
            Synthetic rows vs. live data
          </p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </section>
  );
}
