/**
 * Firebase auth error helpers.
 *
 * We intentionally avoid `instanceof FirebaseError` because Turbopack and
 * other bundlers can ship multiple class identities for the same module
 * across chunk boundaries, which makes the `instanceof` check silently
 * return false even when the error truly is a FirebaseError. Duck-typing
 * on `name === "FirebaseError"` plus an `auth/*` code prefix is robust
 * to that and good enough for the surfaces we care about.
 */
export function getFirebaseAuthErrorCode(err: unknown): string | null {
  if (err === null || typeof err !== "object") return null;
  const candidate = err as { name?: unknown; code?: unknown };
  const code = candidate.code;
  if (typeof code !== "string") return null;
  if (!code.startsWith("auth/")) return null;
  if (candidate.name !== undefined && candidate.name !== "FirebaseError") {
    return null;
  }
  return code;
}
