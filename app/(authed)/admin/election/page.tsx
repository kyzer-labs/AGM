"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarPlus } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  canCreateWorkspaceCycle,
  getCurrentWorkspaceCycle,
} from "@/lib/election-cycles";
import { CreateCycleModal } from "./_components/create-cycle-modal";
import { ElectionArticle } from "./_components/election-article";

export default function ElectionPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const elections = useQuery(api.elections.list);
  const [showCreate, setShowCreate] = useState(false);

  if (elections === undefined) {
    return <PageSkeleton />;
  }

  const existingYears = elections.map((e) => e.year);
  const currentCycle = getCurrentWorkspaceCycle(elections);
  const canCreateCycle = canCreateWorkspaceCycle(elections);

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Election cycle" }]} />

      <header className="space-y-3">
        <SectionMarker primary="Election cycle" secondary="Current workspace" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[65ch] space-y-2">
            <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
              Current cycle controls
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Configure the next active AGM cycle, then move it through
              evaluation, live voting, preview, and publication. Published
              cycles live under Records.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            disabled={!canCreateCycle}
            className="shrink-0 sm:self-start"
            title={
              canCreateCycle
                ? undefined
                : "Publish the active cycle before creating another one."
            }
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> New cycle
          </Button>
        </div>
      </header>

      <CreateCycleModal
        open={canCreateCycle && showCreate}
        onClose={() => setShowCreate(false)}
        existingYears={existingYears}
      />

      {currentCycle === null ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title="No active cycle workspace"
          description="Create the next AGM cycle with the New cycle button above. Published cycles are kept separately in Records."
        />
      ) : (
        <ElectionArticle election={currentCycle} />
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
