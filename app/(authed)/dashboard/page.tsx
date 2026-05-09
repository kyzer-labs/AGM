"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthGate } from "@/components/auth/auth-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type RedirectHref = "/admin" | "/internal" | "/vote" | "/results";

interface StandbyCopy {
  cycleName: string | null;
  body: string;
  scheduledStartAt: number | null;
  scheduledEndAt: number | null;
}

type StageDecision =
  | { kind: "loading" }
  | { kind: "redirect"; href: RedirectHref }
  | { kind: "standby"; standby: StandbyCopy };

export default function DashboardPage() {
  return (
    <AuthGate mode="profileComplete">
      <Stage />
    </AuthGate>
  );
}

function Stage() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const current = useQuery(api.elections.getCurrent);
  const latestPublished = useQuery(api.results.latestPublishedCycle);

  const isAdmin =
    me !== undefined &&
    me !== null &&
    (me.role === "admin" || me.role === "super");

  const internalStatus = useQuery(
    api.internal.myStatus,
    !isAdmin && current ? { electionId: current._id } : "skip",
  );

  const decision: StageDecision = (() => {
    if (me === undefined || me === null) return { kind: "loading" };
    if (isAdmin) return { kind: "redirect", href: "/admin" };
    if (current === undefined || latestPublished === undefined) {
      return { kind: "loading" };
    }
    if (current === null) {
      if (latestPublished) return { kind: "redirect", href: "/results" };
      return {
        kind: "standby",
        standby: {
          cycleName: null,
          body: "No active election right now. Check back when an AGM is announced.",
          scheduledStartAt: null,
          scheduledEndAt: null,
        },
      };
    }
    if (internalStatus === undefined) return { kind: "loading" };

    const isWhitelisted = internalStatus?.isWhitelisted ?? false;
    const scheduledStartAt = current.scheduledStartAt ?? null;
    const scheduledEndAt = current.scheduledEndAt ?? null;

    switch (current.phase) {
      case "setup":
        return {
          kind: "standby",
          standby: {
            cycleName: current.name,
            body: "Cycle being prepared. Voting opens once admins finish setup.",
            scheduledStartAt,
            scheduledEndAt,
          },
        };
      case "internalOpen":
        if (isWhitelisted) return { kind: "redirect", href: "/internal" };
        return {
          kind: "standby",
          standby: {
            cycleName: current.name,
            body: scheduledEndAt
              ? "Internal evaluation is in progress. AGM live voting opens after the internal window closes."
              : "Internal evaluation is in progress. AGM live voting opens shortly.",
            scheduledStartAt,
            scheduledEndAt,
          },
        };
      case "internalClosed":
        return {
          kind: "standby",
          standby: {
            cycleName: current.name,
            body: isWhitelisted
              ? "Internal evaluation submitted. Awaiting AGM live voting."
              : "Internal evaluation has closed. AGM live voting opens shortly.",
            scheduledStartAt,
            scheduledEndAt,
          },
        };
      case "publicVoting":
        if (isWhitelisted) {
          return {
            kind: "standby",
            standby: {
              cycleName: current.name,
              body: "Internal evaluators don't vote in the public ballot. Results post once voting wraps.",
              scheduledStartAt: null,
              scheduledEndAt: null,
            },
          };
        }
        return { kind: "redirect", href: "/vote" };
      case "resultsPreview":
        return {
          kind: "standby",
          standby: {
            cycleName: current.name,
            body: "Voting is complete. Final results are being prepared.",
            scheduledStartAt: null,
            scheduledEndAt: null,
          },
        };
      case "published":
        return { kind: "redirect", href: "/results" };
    }
  })();

  useEffect(() => {
    if (decision.kind === "redirect") {
      router.replace(decision.href);
    }
  }, [decision, router]);

  if (decision.kind === "loading" || decision.kind === "redirect") {
    return (
      <main className="container-narrow space-y-4 py-16">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return <Standby copy={decision.standby} />;
}

function Standby({ copy }: { copy: StandbyCopy }) {
  const windowText = formatScheduleWindow(
    copy.scheduledStartAt,
    copy.scheduledEndAt,
  );

  return (
    <main className="container-narrow flex min-h-[calc(100dvh-3.5rem)] items-center py-16">
      <Card className="surface-glass mx-auto w-full max-w-xl border-0">
        <CardContent className="flex flex-col items-center gap-5 px-7 py-10 text-center">
          <PulsingDot />
          <div className="space-y-2">
            <h1 className="font-display text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
              {copy.cycleName ?? "No active cycle"}
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
              {copy.body}
            </p>
          </div>
          {windowText ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {windowText}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function PulsingDot() {
  return (
    <span
      aria-hidden
      className="relative inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: "var(--teal)" }}
    >
      <span
        className="standby-dot-ring absolute inset-0 rounded-full"
        style={{ backgroundColor: "var(--teal)" }}
      />
    </span>
  );
}

function formatScheduleWindow(
  startAt: number | null,
  endAt: number | null,
): string | null {
  if (!startAt && !endAt) return null;
  const start = startAt ? formatDate(startAt) : null;
  const end = endAt ? formatDate(endAt) : null;
  if (start && end) return `${start} → ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return null;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
