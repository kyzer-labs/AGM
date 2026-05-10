/**
 * Deterministic Malaysia-Time formatters used across every voter-facing
 * surface. The AGM is run from Penang; scheduled windows, ballot
 * timestamps, and confirmation receipts are quoted in MYT regardless of
 * the viewer's locale so a voter abroad reads the same wall-clock time
 * the chairperson sees on stage.
 *
 * Both formatters are bound to `Intl.DateTimeFormat("en-MY", { timeZone:
 * "Asia/Kuala_Lumpur", … })` rather than `toLocaleString()` without an
 * explicit locale; Node and the browser disagree about default-locale
 * defaults, which would silently shift the rendered string between the
 * server-rendered first paint and the client hydration.
 */

const MYT_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kuala_Lumpur",
});

const MYT_TIME_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kuala_Lumpur",
});

/**
 * Full date + time in Malaysia Time, e.g. `Wed, 12 Nov 2026, 14:30 MYT`.
 * Use for scheduled windows, confirmation receipts, audit timestamps.
 */
export function formatMYT(ms: number): string {
  return `${MYT_FORMATTER.format(new Date(ms))} MYT`;
}

/**
 * Time-of-day only in Malaysia Time, e.g. `14:30 MYT`. Use when the
 * surrounding context already establishes the date (live ballot opened
 * during the same AGM session, etc).
 */
export function formatMYTTimeOnly(ms: number): string {
  return `${MYT_TIME_FORMATTER.format(new Date(ms))} MYT`;
}
