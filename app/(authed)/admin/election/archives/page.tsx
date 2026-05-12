"use client";

import { useQuery } from "convex/react";
import { Archive } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "@/convex/_generated/api";
import { getArchivedCycles } from "@/lib/election-cycles";
import { formatMYT } from "@/lib/format";
import type { Doc } from "@/convex/_generated/dataModel";

export default function ElectionArchivesPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const elections = useQuery(api.elections.list);

  if (elections === undefined) return <PageSkeleton />;

  const archivedCycles = getArchivedCycles(elections);

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb
        items={[
          { label: "Election cycle", href: "/admin/election" },
          { label: "Archives" },
        ]}
      />

      <header className="space-y-3">
        <SectionMarker primary="Cycle archives" secondary="Published records" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[65ch] space-y-2">
            <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
              Published cycle archives
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Published cycles are read-only records. Use this page to scan
              previous AGM cycles without mixing them into the active cycle
              controls.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-start">
            <LinkButton href="/admin/election" variant="outline">
              Current cycle
            </LinkButton>
            <LinkButton href="/admin/exports" variant="outline">
              Exports
            </LinkButton>
          </div>
        </div>
      </header>

      {archivedCycles.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-5 w-5" aria-hidden />}
          title="No published cycles archived yet"
          description="Cycles appear here after results are published. Until then, keep working from the current cycle page."
        />
      ) : (
        <ol className="divide-y divide-[var(--ink-line)] border-y border-[var(--ink-line)]">
          {archivedCycles.map((election) => (
            <li key={election._id}>
              <ArchiveRow election={election} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
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

function ArchiveRow({ election }: { election: Doc<"elections"> }) {
  const readiness = useQuery(api.elections.setupReadiness, {
    electionId: election._id,
  });

  return (
    <article className="py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SectionMarker primary={`AGM ${election.year}`} secondary="Archive" />
            <Badge tone="success">Published</Badge>
          </div>
          <h2 className="font-display text-xl font-medium leading-tight text-[var(--ink)]">
            {election.name}
          </h2>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
            Created {formatMYT(election.createdAt)}
          </p>
        </div>

        {readiness ? (
          <MetaGroup className="w-full grid-cols-2 gap-4 border-t-0 pt-0 sm:w-auto sm:min-w-[34rem] sm:grid-cols-5">
            <Meta label="Positions" value={readiness.positionsCount} />
            <Meta label="Candidates" value={readiness.candidatesCount} />
            <Meta label="Whitelist" value={readiness.whitelistCount} />
            <Meta label="Rubric" value={readiness.rubricCriteriaCount} />
            <Meta
              label="Weights"
              value={readiness.weightsValid ? "100%" : "Invalid"}
            />
          </MetaGroup>
        ) : (
          <Skeleton className="h-14 w-full sm:w-[34rem]" />
        )}
      </div>
    </article>
  );
}
