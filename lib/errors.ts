/**
 * Convert any thrown value into a single, user-facing sentence.
 *
 * Convex wraps thrown server errors with a noisy framework prefix that ends
 * up in `Error.message` on the client, e.g.
 *
 *   [CONVEX M(admins:grantAdmin)] [Request ID: bea3479ff7986c137]
 *   Server Error
 *   Uncaught Error: That user has not signed in yet. Ask them to sign in once first.
 *       at handler (../convex/admins.ts:139:9)
 *       ... Called by client
 *
 * We strip every Convex/runtime prefix and trailing stack so the toast only
 * shows the actual application message. Falls back to `fallback` when nothing
 * meaningful is left.
 */
export function friendlyError(
  err: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  if (err === undefined || err === null) return fallback;

  if (typeof err === "string") {
    const cleaned = stripFrameworkNoise(err);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  if (typeof err === "object" && err !== null) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === "string" && data.trim().length > 0) {
      return data.trim();
    }
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
    ) {
      const msg = (data as { message: string }).message.trim();
      if (msg.length > 0) return msg;
    }
  }

  if (err instanceof Error) {
    const cleaned = stripFrameworkNoise(err.message ?? "");
    return cleaned.length > 0 ? cleaned : fallback;
  }

  return fallback;
}

function stripFrameworkNoise(input: string): string {
  let out = input;

  out = out.replace(/^\s*\[CONVEX [^\]]+\]\s*/i, "");
  out = out.replace(/^\s*\[Request ID:\s*[^\]]+\]\s*/i, "");
  out = out.replace(/^\s*Server Error\b\s*/i, "");
  out = out.replace(/\s*Called by client\.?\s*$/i, "");

  const inner = out.match(
    /Uncaught\s+(?:Convex\s*Error|ConvexError|Error):\s*([^\n]+)/i,
  );
  if (inner && inner[1]) {
    out = inner[1];
  } else {
    const convexLabel = out.match(/Convex\s*error:\s*([^\n]+)/i);
    if (convexLabel && convexLabel[1]) out = convexLabel[1];
  }

  out = out
    .split(/\n+/)
    .filter((line) => !/^\s*at\s+/i.test(line))
    .join(" ");

  return out.replace(/\s+/g, " ").trim();
}
