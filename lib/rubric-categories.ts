/**
 * Rubric category metadata. Single source of truth shared by:
 *
 *   - components/internal/rubric-help.tsx (the always-on reference panel)
 *   - app/(authed)/internal/page.tsx       (the per-criterion stepper)
 *
 * The category list mirrors the original five-rubric design from the
 * AGM workbook. Criterion documents in Convex (`rubricCriteria`) carry
 * a free-text `name`, so we match by lowercase substring at render
 * time. If a criterion's name does not match any known category, the
 * stepper falls back to showing only the score legend.
 */
export interface RubricCategory {
  key: string;
  label: string;
  bullets: string[];
  matchTokens: string[];
}

export const RUBRIC_CATEGORIES: RubricCategory[] = [
  {
    key: "leadership",
    label: "Leadership",
    bullets: [
      "Visionary and mature thinking",
      "Leadership and inspiration",
      "Accountability",
      "Strategic decision-making",
      "Task supervision and delegation",
    ],
    matchTokens: ["leadership", "lead"],
  },
  {
    key: "teamwork",
    label: "Teamwork & Communication",
    bullets: [
      "Team collaboration",
      "Willingness to listen",
      "Conflict resolution and management",
      "Clear communication",
    ],
    matchTokens: ["teamwork", "communication", "team"],
  },
  {
    key: "professionalism",
    label: "Professionalism & Ethics",
    bullets: [
      "Trustworthiness",
      "Reliability",
      "Moral integrity",
      "Follows rules and standards",
      "Acts as a role model",
    ],
    matchTokens: ["professional", "ethic"],
  },
  {
    key: "commitment",
    label: "Commitment",
    bullets: [
      "Deadline adherence",
      "Task prioritization and attitude",
      "Initiative and enthusiasm",
      "Engagement in discussions",
    ],
    matchTokens: ["commitment", "commit", "deadline"],
  },
  {
    key: "personality",
    label: "Personality",
    bullets: [
      "Politeness and humility",
      "Thoughtfulness and consideration",
      "Friendliness",
      "Positivity",
      "Networking ability",
    ],
    matchTokens: ["personality"],
  },
];

export interface ScoreLegendEntry {
  score: number;
  label: string;
}

/**
 * Standard legend covers a 5-point rubric. Criteria configured with
 * a higher `maxScore` get the legend rendered as a single hint row
 * instead of a per-step grid.
 */
export const SCORE_LEGEND: ScoreLegendEntry[] = [
  { score: 1, label: "Unsatisfactory" },
  { score: 2, label: "Satisfactory" },
  { score: 3, label: "Average" },
  { score: 4, label: "Competent" },
  { score: 5, label: "Excellent" },
];

/**
 * Find the rubric category that best matches a criterion name. Returns
 * null when nothing matches. Matching is case-insensitive substring on
 * the configured token list.
 */
export function matchRubricCategory(
  criterionName: string,
): RubricCategory | null {
  const haystack = criterionName.toLowerCase();
  for (const cat of RUBRIC_CATEGORIES) {
    for (const token of cat.matchTokens) {
      if (haystack.includes(token)) return cat;
    }
  }
  return null;
}
