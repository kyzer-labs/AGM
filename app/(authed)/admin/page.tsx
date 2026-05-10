"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  FlaskConical,
  ListChecks,
  Settings2,
  Users,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Skeleton } from "@/components/ui/skeleton";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";

type AdminTechnique =
  | "Setup"
  | "Roster"
  | "Ballot ops"
  | "Reporting"
  | "System";

interface AdminTile {
  href: string;
  technique: AdminTechnique;
  title: string;
  body: string;
  badge?: string;
}

type Phase = Doc<"elections">["phase"];

interface SetupReadiness {
  ready: boolean;
  positionsCount: number;
  candidatesCount: number;
  whitelistCount: number;
  unassignedCandidates: number;
  positionsWithoutCandidates: number;
  rubricCriteriaCount: number;
  weightsValid: boolean;
  warnings: string[];
}

const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const PHASE_TONES: Record<
  Phase,
  "neutral" | "brand" | "success" | "warning" | "muted"
> = {
  setup: "muted",
  internalOpen: "brand",
  internalClosed: "neutral",
  publicVoting: "brand",
  resultsPreview: "warning",
  published: "success",
};

function phaseActions(phase: Phase): AdminTile[] {
  if (phase === "setup") {
    return [
      {
        href: "/admin/election",
        technique: "Setup",
        title: "Review cycle readiness",
        body: "Confirm schedule, weightage, rubric, and readiness before opening internal evaluation.",
      },
      {
        href: "/admin/positions",
        technique: "Setup",
        title: "Define positions",
        body: "Set every role, tier, and ballot order before candidate assignment.",
      },
      {
        href: "/admin/candidates",
        technique: "Setup",
        title: "Add candidates",
        body: "Attach candidate records and map each candidate to at least one position.",
      },
      {
        href: "/admin/whitelist",
        technique: "Roster",
        title: "Load internal whitelist",
        body: "Add Year 2 evaluators and class weights before opening the rubric window.",
      },
    ];
  }

  if (phase === "internalOpen") {
    return [
      {
        href: "/admin/internal",
        technique: "Roster",
        title: "Monitor rubric completion",
        body: "Track evaluator submissions and identify missing internal input before closing.",
      },
      {
        href: "/admin/whitelist",
        technique: "Roster",
        title: "Maintain evaluator access",
        body: "Add or correct whitelist rows while the internal window is still open.",
      },
      {
        href: "/admin/election",
        technique: "Setup",
        title: "Close internal evaluation",
        body: "Move the cycle forward once evaluator completion is acceptable.",
      },
    ];
  }

  if (phase === "internalClosed") {
    return [
      {
        href: "/admin/internal",
        technique: "Roster",
        title: "Review internal totals",
        body: "Inspect submitted evaluator coverage and aggregate rubric scores.",
      },
      {
        href: "/admin/election",
        technique: "Ballot ops",
        title: "Start public voting",
        body: "Transition the cycle into the live AGM voting phase when the room is ready.",
      },
      {
        href: "/admin/public",
        technique: "Ballot ops",
        title: "Stage live ballots",
        body: "Check position order and prepare the first ballot before opening voting.",
      },
    ];
  }

  if (phase === "publicVoting") {
    return [
      {
        href: "/admin/public",
        technique: "Ballot ops",
        title: "Run live voting",
        body: "Open one position at a time, monitor turnout, and close each ballot.",
      },
      {
        href: "/admin/results",
        technique: "Reporting",
        title: "Check result readiness",
        body: "Resolve blocking ties and move to preview only after every ballot is closed.",
      },
    ];
  }

  if (phase === "resultsPreview") {
    return [
      {
        href: "/admin/results",
        technique: "Reporting",
        title: "Resolve and publish",
        body: "Review the combined breakdown, resolve ties, and publish the official record.",
      },
      {
        href: "/admin/public",
        technique: "Ballot ops",
        title: "Reopen voting if required",
        body: "Return to live voting only if the room needs a correction before publication.",
      },
    ];
  }

  return [
    {
      href: "/admin/election",
      technique: "System",
      title: "Prepare the next AGM",
      body: "Create the next annual cycle when planning begins. The published cycle stays as the record until then.",
    },
    {
      href: "/admin/results",
      technique: "Reporting",
      title: "Review published results",
      body: "Keep the official result breakdown available for post-AGM checks.",
    },
    {
      href: "/admin/exports",
      technique: "Reporting",
      title: "Archive exports",
      body: "Download the voter roll, evaluation data, public votes, and audit log after the cycle closes.",
    },
  ];
}

function AdminPageInner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const superExists = useQuery(api.admins.superAdminExists);
  const devConfig = useQuery(api.dev.config);
  const current = useQuery(api.elections.getCurrent);
  const readiness = useQuery(
    api.elections.setupReadiness,
    current?.phase === "setup" ? { electionId: current._id } : "skip",
  );

  const isAdmin =
    adminStatus?.role === "admin" || adminStatus?.role === "super";
  const isSuper = adminStatus?.role === "super";
  const devEnabled = devConfig?.enabled === true;

  useEffect(() => {
    if (
      adminStatus === undefined ||
      superExists === undefined ||
      me === undefined
    ) {
      return;
    }
    if (!isAdmin && superExists) {
      router.replace("/dashboard");
    }
  }, [adminStatus, superExists, me, isAdmin, router]);

  if (
    me === undefined ||
    adminStatus === undefined ||
    superExists === undefined ||
    current === undefined
  ) {
    return <PageSkeleton />;
  }

  if (!isAdmin && superExists) {
    return null;
  }

  const headerCopy = isAdmin
    ? {
        markerSecondary: isSuper ? "Super admin" : "Admin",
        title: "AGM command center",
        body: current
          ? "Only the current phase is expanded here. Detailed admin pages remain available when you need to inspect or correct something specific."
          : "Create the next AGM cycle to begin setup. System tools stay available below for rehearsal and admin maintenance.",
      }
    : {
        markerSecondary: "Setup pending",
        title: "Admin setup",
        body: "Become the first super admin for this deployment. Once complete, this page becomes the phase command center.",
      };

  return (
    <main className="container-wide space-y-12 py-12 sm:py-16">
      <header className="space-y-4">
        <SectionMarker
          primary="Admin console"
          secondary={headerCopy.markerSecondary}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {headerCopy.title}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {headerCopy.body}
        </p>
      </header>

      <BootstrapPanel />

      {isAdmin ? (
        <>
          {current ? (
            <PhaseCommandCenter
              election={current}
              readiness={readiness}
              devEnabled={devEnabled}
            />
          ) : (
            <NoCycleCommandCenter devEnabled={devEnabled} />
          )}
        </>
      ) : null}
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGate mode="profileComplete">
      <AdminPageInner />
    </AuthGate>
  );
}

function PhaseCommandCenter({
  election,
  readiness,
  devEnabled,
}: {
  election: Doc<"elections">;
  readiness: SetupReadiness | undefined;
  devEnabled: boolean;
}) {
  const actions = phaseActions(election.phase);
  const isPublished = election.phase === "published";

  return (
    <section
      className="grid gap-8 border-y border-[var(--ink-line)] py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]"
      aria-labelledby="phase-command-heading"
    >
      <div className="space-y-5">
        <SectionMarker
          primary="Current phase"
          secondary={PHASE_LABELS[election.phase]}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="phase-command-heading"
              className="font-display text-2xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-3xl"
            >
              {election.name}
            </h2>
            <Badge tone={PHASE_TONES[election.phase]}>
              <Circle className="h-3 w-3 fill-current" aria-hidden />
              {PHASE_LABELS[election.phase]}
            </Badge>
          </div>
          <p className="max-w-[58ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {phaseBody(election.phase)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={actions[0]?.href ?? "/admin/election"}>
            {primaryActionLabel(election.phase)}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
          {devEnabled ? (
            <LinkButton href="/admin/dev" variant="outline">
              <FlaskConical className="h-4 w-4" aria-hidden />
              Dev seeder
            </LinkButton>
          ) : null}
        </div>
      </div>

      <div className="space-y-8">
        {election.phase === "setup" ? (
          <SetupChecklist readiness={readiness} />
        ) : null}

        <div>
          <SectionMarker
            primary={isPublished ? "Post-cycle" : "Phase work"}
            secondary={`${actions.length} ${
              actions.length === 1 ? "page" : "pages"
            }`}
          />
          <ol className="mt-4 space-y-0" aria-label="Current phase actions">
            {actions.map((tile, index) => (
              <li key={tile.href}>
                <AdminIndexItem tile={tile} index={index} compact />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function NoCycleCommandCenter({ devEnabled }: { devEnabled: boolean }) {
  return (
    <NoticeStrip
      markerPrimary="No active cycle"
      markerSecondary="Start here"
      headline="Create the next annual AGM cycle"
    >
      <p className="max-w-[64ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        The admin console stays intentionally small until a cycle exists.
        Create the annual cycle first, then setup opens as an ordered
        checklist.
      </p>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/admin/election">
          <Settings2 className="h-4 w-4" aria-hidden />
          Create cycle
        </LinkButton>
        {devEnabled ? (
          <LinkButton href="/admin/dev" variant="outline">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Dev seeder
          </LinkButton>
        ) : null}
      </div>
    </NoticeStrip>
  );
}

function SetupChecklist({
  readiness,
}: {
  readiness: SetupReadiness | undefined;
}) {
  const items = [
    {
      href: "/admin/election",
      label: "Cycle, schedule, weights, rubric",
      complete: readiness
        ? readiness.weightsValid && readiness.rubricCriteriaCount > 0
        : false,
      detail: readiness
        ? `${readiness.rubricCriteriaCount} rubric ${
            readiness.rubricCriteriaCount === 1 ? "criterion" : "criteria"
          }`
        : "Checking setup",
      icon: Settings2,
    },
    {
      href: "/admin/positions",
      label: "Positions and ballot order",
      complete: readiness
        ? readiness.positionsCount > 0 &&
          readiness.positionsWithoutCandidates === 0
        : false,
      detail: readiness
        ? `${readiness.positionsCount} ${
            readiness.positionsCount === 1 ? "position" : "positions"
          }`
        : "Checking positions",
      icon: ListChecks,
    },
    {
      href: "/admin/candidates",
      label: "Candidates assigned to positions",
      complete: readiness
        ? readiness.candidatesCount > 0 && readiness.unassignedCandidates === 0
        : false,
      detail: readiness
        ? `${readiness.candidatesCount} ${
            readiness.candidatesCount === 1 ? "candidate" : "candidates"
          }`
        : "Checking candidates",
      icon: Users,
    },
    {
      href: "/admin/whitelist",
      label: "Internal evaluator whitelist",
      complete: readiness ? readiness.whitelistCount > 0 : false,
      detail: readiness
        ? `${readiness.whitelistCount} ${
            readiness.whitelistCount === 1 ? "evaluator" : "evaluators"
          }`
        : "Checking whitelist",
      icon: ClipboardList,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionMarker
          primary="Setup checklist"
          secondary={readiness?.ready ? "Ready" : "Ordered"}
        />
        <Badge tone={readiness?.ready ? "success" : "warning"}>
          {readiness?.ready ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Circle className="h-3.5 w-3.5 fill-current" aria-hidden />
          )}
          {readiness?.ready ? "Ready to open" : "Needs attention"}
        </Badge>
      </div>

      <ol className="mt-4 divide-y divide-[var(--ink-line)] border-y border-[var(--ink-line)]">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group grid gap-3 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--paper-2)_72%,transparent)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 rounded-full border border-[var(--ink-line)] p-1.5 text-[var(--ink-muted)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--ink)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                      {item.detail}
                    </span>
                  </span>
                </span>
                <Badge tone={item.complete ? "success" : "muted"}>
                  {item.complete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Circle className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {item.complete ? "Complete" : "Open"}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ol>

      {readiness && readiness.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Blocking notes
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {readiness.warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AdminIndexItem({
  tile,
  index,
  compact = false,
}: {
  tile: AdminTile;
  index: number;
  compact?: boolean;
}) {
  return (
    <Link
      href={tile.href}
      className="group block border-t border-[var(--ink-line)] py-5 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ink)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <span
          className="font-mono text-xl font-medium tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <SectionMarker primary={tile.technique} />
        <h3 className="font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors group-hover:text-[var(--teal)] sm:text-xl">
          {tile.title}
        </h3>
        {tile.badge ? (
          <Badge tone="muted">
            <Circle className="h-3 w-3" aria-hidden />
            {tile.badge}
          </Badge>
        ) : null}
      </div>
      <p
        className={
          compact
            ? "mt-2 max-w-[58ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]"
            : "mt-2 max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]"
        }
      >
        {tile.body}
      </p>
    </Link>
  );
}

function phaseBody(phase: Phase) {
  if (phase === "setup") {
    return "Work through setup in order. The cycle should only open once positions, candidates, whitelist, rubric, and weights are coherent.";
  }
  if (phase === "internalOpen") {
    return "The concern now is evaluator completion. Keep setup changes limited to access corrections and close the window when internal input is acceptable.";
  }
  if (phase === "internalClosed") {
    return "Internal scoring is locked. Prepare the live room, then move the cycle to public AGM voting.";
  }
  if (phase === "publicVoting") {
    return "Run one ballot at a time. The primary concern is live control, turnout visibility, and closing every position before preview.";
  }
  if (phase === "resultsPreview") {
    return "The room is past voting. Resolve ties, inspect the combined result, and publish only when the record is ready.";
  }
  return "The cycle is closed and published. Keep exports and the result record accessible during the post-cycle period, then create the next annual cycle when planning begins.";
}

function primaryActionLabel(phase: Phase) {
  if (phase === "setup") return "Continue setup";
  if (phase === "internalOpen") return "Monitor internal evaluation";
  if (phase === "internalClosed") return "Start live voting";
  if (phase === "publicVoting") return "Run live voting";
  if (phase === "resultsPreview") return "Review results";
  return "Post-cycle archive";
}

function PageSkeleton() {
  return (
    <main className="container-narrow space-y-6 py-12 sm:py-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

function BootstrapPanel() {
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const bootstrap = useMutation(api.admins.bootstrapSuperAdmin);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (adminStatus !== null) return null;
  if (!me?.profileComplete) return null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await bootstrap({ token });
      toast.success("Super admin granted to your account.");
    } catch (err) {
      const message = getConvexErrorMessage(err, "Bootstrap failed.");
      toast.error("Bootstrap failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NoticeStrip
      markerPrimary="First-time setup"
      markerSecondary="Required"
      headline="Become super admin"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        No super admin exists yet. Paste the{" "}
        <code className="rounded bg-[var(--paper)] px-1.5 py-0.5 font-mono text-xs">
          SUPER_ADMIN_BOOTSTRAP_TOKEN
        </code>{" "}
        you set on the Convex deployment to claim super admin for{" "}
        <strong className="font-semibold text-[var(--ink)]">{me.email}</strong>
        . This bootstrap path can be used exactly once.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:flex sm:items-end">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="bootstrap-token">Bootstrap token</Label>
          <Input
            id="bootstrap-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste the token from your Convex env"
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" loading={submitting}>
          Become super admin
        </Button>
      </form>
    </NoticeStrip>
  );
}
