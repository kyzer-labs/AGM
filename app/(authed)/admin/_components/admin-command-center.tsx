import Link from "next/link";
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

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  phaseActions,
  PHASE_LABELS,
  PHASE_TONES,
  type AdminTile,
  type Phase,
  type SetupReadiness,
} from "./admin-command-model";

export function PhaseCommandCenter({
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

      <div className="space-y-6">
        {election.phase === "setup" ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(16rem,0.82fr)]">
            <SetupChecklist readiness={readiness} />
            <PhaseWorkIndex actions={actions} isPublished={isPublished} />
          </div>
        ) : (
          <PhaseWorkIndex actions={actions} isPublished={isPublished} />
        )}
      </div>
    </section>
  );
}

export function NoCycleCommandCenter({ devEnabled }: { devEnabled: boolean }) {
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
        <div className="mt-3 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Blocking notes
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            {readiness.warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PhaseWorkIndex({
  actions,
  isPublished,
}: {
  actions: AdminTile[];
  isPublished: boolean;
}) {
  return (
    <div>
      <SectionMarker
        primary={isPublished ? "Post-cycle" : "Phase work"}
        secondary={`${actions.length} ${actions.length === 1 ? "page" : "pages"}`}
      />
      <ol className="mt-3 space-y-0" aria-label="Current phase actions">
        {actions.map((tile, index) => (
          <li key={tile.href}>
            <AdminIndexItem tile={tile} index={index} compact />
          </li>
        ))}
      </ol>
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
      className={
        compact
          ? "group block border-t border-[var(--ink-line)] py-3 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ink)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
          : "group block border-t border-[var(--ink-line)] py-5 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ink)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
      }
    >
      <div
        className={
          compact
            ? "grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1"
            : "flex flex-wrap items-baseline gap-x-4 gap-y-1.5"
        }
      >
        <span
          className={
            compact
              ? "font-mono text-sm font-medium tabular-nums text-[var(--ink-muted)]"
              : "font-mono text-xl font-medium tabular-nums text-[var(--ink-muted)]"
          }
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionMarker primary={tile.technique} />
            {tile.badge ? (
              <Badge tone="muted">
                <Circle className="h-3 w-3" aria-hidden />
                {tile.badge}
              </Badge>
            ) : null}
          </span>
          <h3
            className={
              compact
                ? "mt-1 font-display text-sm font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors group-hover:text-[var(--teal)]"
                : "mt-1 font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors group-hover:text-[var(--teal)] sm:text-xl"
            }
          >
            {tile.title}
          </h3>
        </span>
      </div>
      {compact ? (
        <p className="mt-1.5 max-w-[58ch] pl-11 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          {tile.body}
        </p>
      ) : (
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {tile.body}
        </p>
      )}
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

