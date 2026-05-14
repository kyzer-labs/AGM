type ElectionCycleLike = {
  phase: string;
  createdAt: number;
};

function newestFirst<T extends ElectionCycleLike>(cycles: readonly T[]): T[] {
  return cycles.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function getCurrentWorkspaceCycle<T extends ElectionCycleLike>(
  cycles: readonly T[],
): T | null {
  return newestFirst(cycles).find((cycle) => cycle.phase !== "published") ?? null;
}

export function getArchivedCycles<T extends ElectionCycleLike>(
  cycles: readonly T[],
): T[] {
  return newestFirst(cycles).filter((cycle) => cycle.phase === "published");
}

export function canCreateWorkspaceCycle<T extends ElectionCycleLike>(
  cycles: readonly T[],
): boolean {
  return getCurrentWorkspaceCycle(cycles) === null;
}
