import { ConvexError } from "convex/values";

/**
 * Extract a user-friendly message from any error thrown by a Convex
 * mutation/query/action.
 *
 * Convex prefixes errors with `[CONVEX M(name)] [Request ID: …]` and, for
 * non-`ConvexError` throws, replaces the original message with `Server Error`
 * for safety. This helper:
 *
 *   1. Prefers `ConvexError.data` when it's a plain string or `{ message }`.
 *   2. Strips Convex's `[CONVEX …]` / `[Request ID: …]` / trailing
 *      "Called by client" noise from any other Error.
 *   3. Falls back to the provided fallback when the result is empty or a
 *      generic "Server Error" (i.e. the backend threw a plain Error and
 *      the real reason is server-side only).
 */
export function getConvexErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  if (err instanceof ConvexError) {
    const data: unknown = err.data;
    if (typeof data === "string" && data.trim().length > 0) {
      return data;
    }
    if (
      data !== null &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string" &&
      ((data as { message: string }).message).trim().length > 0
    ) {
      return (data as { message: string }).message;
    }
  }

  if (err instanceof Error && typeof err.message === "string") {
    const cleaned = err.message
      .replace(/^\[CONVEX [^\]]+\]\s*/, "")
      .replace(/\[Request ID:[^\]]+\]\s*/, "")
      .replace(/\s*Called by client\.?\s*$/, "")
      .trim();

    if (
      cleaned.length > 0 &&
      cleaned !== "Server Error" &&
      !cleaned.includes("ArgumentValidationError") &&
      !cleaned.includes("Server Error")
    ) {
      return cleaned;
    }
  }

  return fallback;
}
