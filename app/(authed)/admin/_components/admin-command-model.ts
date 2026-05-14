import type { Doc } from "@/convex/_generated/dataModel";

export type AdminTechnique =
  | "Setup"
  | "Roster"
  | "Ballot ops"
  | "Reporting"
  | "System";

export interface AdminTile {
  href: string;
  technique: AdminTechnique;
  title: string;
  body: string;
  badge?: string;
}

export type Phase = Doc<"elections">["phase"];

export interface SetupReadiness {
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

export const PHASE_LABELS: Record<Phase, string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export const PHASE_TONES: Record<
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

export function phaseActions(phase: Phase): AdminTile[] {
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

