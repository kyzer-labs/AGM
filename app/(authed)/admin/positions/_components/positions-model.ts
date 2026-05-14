import { z } from "zod";
import type { Doc } from "@/convex/_generated/dataModel";

export const TIER_LABELS: Record<number, string> = {
  1: "President",
  2: "Vice Presidents",
  3: "Directors",
  4: "Other",
};

export const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

export const POSITION_FALLBACK_PAGE_SIZE = 6;
export const POSITION_MIN_ROWS = 1;
export const POSITION_CARD_ROW_HEIGHT = 140;
export const POSITION_BOTTOM_GUTTER = 48;
export const POSITION_DESKTOP_COLUMNS = 2;
export const POSITION_MOBILE_COLUMNS = 1;

export const DEFAULT_TIER_FOR_NAME = (name: string): number => {
  const n = name.toLowerCase();
  if (n.includes("president") && !n.includes("vice")) return 1;
  if (n.includes("vice president") || n.startsWith("vp")) return 2;
  if (n.includes("director")) return 3;
  return 4;
};

export const DEFAULT_POSITIONS = [
  "President",
  "Vice President of Internal Affairs",
  "Vice President of External Affairs",
  "Director of Secretarial Department",
  "Director of Financial Department",
  "Director of Creative Department",
  "Director of Growth Marketing Department",
  "Director of Community Engagement Department",
  "Director of Technical Department",
];

export const positionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(80, "At most 80 characters"),
  tier: z.coerce
    .number({ invalid_type_error: "Tier must be a number" })
    .int("Tier must be a whole number")
    .min(1, "Tier 1 or higher")
    .max(9, "Tier 9 or lower"),
});
export type PositionFormValues = z.infer<typeof positionSchema>;
