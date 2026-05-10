"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthGate } from "@/components/auth/auth-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMYT } from "@/lib/format";

type RedirectHref = "/admin" | "/internal" | "/vote" | "/results";

type ElectionPhase =
  | "setup"
  | "internalOpen"
  | "internalClosed"
  | "publicVoting"
  | "resultsPreview"
  | "published";

type StandbyPhase = ElectionPhase | "noCycle";

interface StandbyCopy {
  cycleName: string | null;
  phase: StandbyPhase;
  body: string;
  scheduledStartAt: number | null;
  scheduledEndAt: number | null;
}

type StageDecision =
  | { kind: "loading" }
  | { kind: "redirect"; href: RedirectHref }
  | { kind: "standby"; standby: StandbyCopy };

const PHASE_LABEL: Record<StandbyPhase, string> = {
  noCycle: "Awaiting next AGM",
  setup: "Cycle in setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "AGM live voting",
  resultsPreview: "Results preparing",
  published: "Results published",
};

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
          phase: "noCycle",
          body: "No election cycle is active. The dashboard updates the moment admins announce the next AGM.",
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
            phase: "setup",
            body: "Admins are still configuring this cycle (positions, candidates, internal whitelist). Voting opens once setup is finished.",
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
            phase: "internalOpen",
            body: "Internal evaluation is in progress. AGM live voting opens once the internal window closes; this dashboard updates automatically when it does.",
            scheduledStartAt,
            scheduledEndAt,
          },
        };
      case "internalClosed":
        return {
          kind: "standby",
          standby: {
            cycleName: current.name,
            phase: "internalClosed",
            body: isWhitelisted
              ? "Your internal evaluation has been submitted. AGM live voting is reserved for external members."
              : "The internal evaluation window has closed. AGM live voting opens shortly; the page updates the moment a ballot opens.",
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
              phase: "publicVoting",
              body: "Internal evaluators do not vote in the public ballot. Results are posted here once the chairperson publishes them.",
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
            phase: "resultsPreview",
            body: "All ballots are closed. Final results are being prepared and will appear here as soon as the chairperson publishes them.",
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
      <main className="container-narrow space-y-6 py-20 sm:py-24">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }

  return <Standby copy={decision.standby} />;
}

function Standby({ copy }: { copy: StandbyCopy }) {
  return (
    <main className="container-narrow py-20 sm:py-24">
      <header className="space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
          Standby <span aria-hidden>·</span> {PHASE_LABEL[copy.phase]}
        </p>
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {copy.cycleName ?? "No active AGM cycle"}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {copy.body}
        </p>
      </header>

      {copy.scheduledStartAt || copy.scheduledEndAt ? (
        <dl className="mt-12 grid gap-6 border-t border-[var(--ink-line)] pt-8 sm:grid-cols-2">
          {copy.scheduledStartAt ? (
            <div className="space-y-1.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                Window opens
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--ink)]">
                {formatMYT(copy.scheduledStartAt)}
              </dd>
            </div>
          ) : null}
          {copy.scheduledEndAt ? (
            <div className="space-y-1.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                Window closes
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--ink)]">
                {formatMYT(copy.scheduledEndAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-12 flex items-center gap-3">
        <PulsingDot />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Live. Auto-updates the moment the phase changes.
        </p>
      </div>
    </main>
  );
}

function PulsingDot() {
  return (
    <span
      aria-hidden
      className="relative inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: "var(--teal)" }}
    >
      <span
        className="standby-dot-ring absolute inset-0 rounded-full"
        style={{ backgroundColor: "var(--teal)" }}
      />
    </span>
  );
}
