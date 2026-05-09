/**
 * Client-side helpers for reading the four dynamic weight fields on an
 * election doc. Mirrors `convex/lib/cycle.ts` defaults but uses a purely
 * structural local type so this file can be imported from any UI module
 * without dragging in Convex types or generated APIs.
 */

export interface ElectionWeightsLike {
  weightTopCommittee?: number;
  weightHeadExecutive?: number;
  weightYear2Committee?: number;
  weightPublic?: number;
}

export interface ResolvedWeights {
  topCommittee: number;
  headExecutive: number;
  year2Committee: number;
  public: number;
}

export const DEFAULT_WEIGHTS: ResolvedWeights = {
  topCommittee: 30,
  headExecutive: 20,
  year2Committee: 10,
  public: 40,
};

export function getWeights(election: ElectionWeightsLike): ResolvedWeights {
  return {
    topCommittee: election.weightTopCommittee ?? DEFAULT_WEIGHTS.topCommittee,
    headExecutive:
      election.weightHeadExecutive ?? DEFAULT_WEIGHTS.headExecutive,
    year2Committee:
      election.weightYear2Committee ?? DEFAULT_WEIGHTS.year2Committee,
    public: election.weightPublic ?? DEFAULT_WEIGHTS.public,
  };
}

/**
 * Combined internal share (TC + HE + Y2) as a percent. The split between
 * "internal" and "public" used to be hardcoded to 75/25 — this is the
 * dynamic equivalent driven by admin-configured weights.
 */
export function internalSharePercent(weights: ResolvedWeights): number {
  const sum =
    weights.topCommittee + weights.headExecutive + weights.year2Committee;
  return Math.round(sum);
}

/**
 * Returns a short human-readable label like `"60 / 40"` describing the
 * internal / public split. Avoids decimals so it reads cleanly in copy.
 */
export function formatSplitLabel(weights: ResolvedWeights): string {
  const internal = internalSharePercent(weights);
  const publicShare = Math.max(0, Math.min(100, 100 - internal));
  return `${internal} / ${publicShare}`;
}
