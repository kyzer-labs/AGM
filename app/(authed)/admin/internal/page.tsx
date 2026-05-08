"use client";

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
import type { Doc } from "@/convex/_generated/dataModel";

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

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Internal evaluation" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Internal evaluation
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Year 2 whitelist for <strong>{election.name}</strong>. Open or
            close the window from the{" "}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden />
              Whitelist completion
            </CardTitle>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {completion.length} evaluator(s)
            </span>
          </div>
          <CardDescription>
            Per-evaluator status. Voters who haven&apos;t signed in yet show
            as &quot;Not signed in&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {completion.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="Whitelist is empty"
              description="Add Year 2 evaluators on the Whitelist page first."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {completion.map((row) => (
                    <tr key={row.email} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{row.email}</td>
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
            Aggregate scores (submitted only)
          </CardTitle>
          <CardDescription>
            Average rubric score per candidate across submitted evaluations.
            Scores from drafts are not counted.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {aggregate.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
              title="No candidates yet"
              description="Add candidates on the Candidates page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--color-muted)]/40 text-left">
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium text-right">N</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Leadership
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Teamwork
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Professionalism
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Commitment
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Personality
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Overall
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.map((row) => (
                    <tr
                      key={row.candidateId}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.fullName}</div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          {row.matric}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.evaluatorCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.averages.leadership)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.averages.teamwork)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.averages.professionalism)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.averages.commitment)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.averages.personality)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {fmt(row.overall)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function fmt(n: number): string {
  if (n === 0) return "—";
  return n.toFixed(2);
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
