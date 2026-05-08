import type { Doc } from "../_generated/dataModel";

export type VoterClass =
  | "topCommittee"
  | "headExecutive"
  | "year2Committee";

export const VOTER_CLASSES: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

export const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

export interface CycleWeights {
  topCommittee: number;
  headExecutive: number;
  year2Committee: number;
  public: number;
}

export const DEFAULT_WEIGHTS: CycleWeights = {
  topCommittee: 30,
  headExecutive: 20,
  year2Committee: 10,
  public: 40,
};

export function getWeights(election: Doc<"elections">): CycleWeights {
  return {
    topCommittee:
      election.weightTopCommittee ?? DEFAULT_WEIGHTS.topCommittee,
    headExecutive:
      election.weightHeadExecutive ?? DEFAULT_WEIGHTS.headExecutive,
    year2Committee:
      election.weightYear2Committee ?? DEFAULT_WEIGHTS.year2Committee,
    public: election.weightPublic ?? DEFAULT_WEIGHTS.public,
  };
}

export function validateWeights(weights: CycleWeights): void {
  const entries: [string, number][] = [
    ["Top Committee", weights.topCommittee],
    ["Head Executive", weights.headExecutive],
    ["Year 2 Committee", weights.year2Committee],
    ["Public", weights.public],
  ];
  for (const [name, value] of entries) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${name} weight must be between 0 and 100.`);
    }
  }
  const sum =
    weights.topCommittee +
    weights.headExecutive +
    weights.year2Committee +
    weights.public;
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(
      `Weights must sum to exactly 100% (got ${sum.toFixed(2)}%).`,
    );
  }
}

export function getEntryClass(
  entry: Doc<"internalWhitelist">,
): VoterClass {
  return entry.voterClass ?? "year2Committee";
}

export const DEFAULT_RUBRIC_CRITERIA: Array<{ name: string; maxScore: number }> = [
  { name: "Leadership", maxScore: 5 },
  { name: "Teamwork & Communication", maxScore: 5 },
  { name: "Professionalism & Ethics", maxScore: 5 },
  { name: "Commitment", maxScore: 5 },
  { name: "Personality", maxScore: 5 },
];
