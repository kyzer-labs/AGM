import * as React from "react";
import { SectionMarker } from "@/components/ui/section-marker";
import { cn } from "@/lib/utils";

/**
 * `<NoticeStrip>` is the copper-bordered editorial notice the admin tree
 * uses for first-time setup, phase-mismatch warnings, action gates, and
 * blocking-tie alerts. Tier 2 of the audit-and-rework sweep flagged the
 * pattern (`border-y` in copper, `--paper-2` ground, `SectionMarker` +
 * display h2 + body + slot) inlined five separate times across `/admin`,
 * `/admin/public`, and `/admin/results`; this primitive consolidates
 * every one of them and is the canonical home for the same shape on the
 * Tier 3 admin setup pages.
 *
 * The internal layout is fixed: a tight `<SectionMarker>` + `<h2>`
 * header group sits at the top, then `children` carries the body
 * paragraph, action button(s), or form. The h2's id is wired into
 * `aria-labelledby` automatically so callers don't have to manage it.
 *
 * Sizing notes: paddings and the outer rhythm pick the most generous
 * inlined values (the bootstrap panel's `py-6 sm:py-8` / `space-y-5`)
 * to give every notice consistent breathing room. The h2 stays at the
 * majority `text-xl sm:text-2xl` step so the page-level h1 keeps a
 * clear hierarchical lead.
 *
 * Tone notes: `tone` controls the section's border accent; the
 * `<SectionMarker>` middle dot is intentionally always copper because
 * the shared marker primitive is single-tone. For non-copper tones,
 * use `markerIcon` to carry the matching accent (e.g. an
 * `AlertTriangle` painted in the destructive color).
 */

type Tone = "copper" | "destructive" | "neutral";

const toneClasses: Record<Tone, string> = {
  copper: "border-[var(--copper)]",
  destructive: "border-[var(--color-destructive)]",
  neutral: "border-[var(--ink-line)]",
};

export interface NoticeStripProps {
  /** Primary section marker (e.g. "First-time setup", "Unresolved ties"). */
  markerPrimary: string;
  /** Optional secondary marker, joined to primary by a copper middle-dot. */
  markerSecondary?: string;
  /**
   * Optional inline icon rendered to the left of the section marker.
   * Use for alert-style notices (e.g. `AlertTriangle` in copper) where
   * the marker alone underplays the urgency.
   */
  markerIcon?: React.ReactNode;
  /** Display-family h2 headline. */
  headline: string;
  /** Body content + actions (paragraphs, forms, buttons, lists). */
  children: React.ReactNode;
  /** Visual tone — controls border color. Defaults to "copper". */
  tone?: Tone;
  /** Optional ARIA role; pass "alert" for blocking-action notices. */
  role?: "alert";
  className?: string;
}

export function NoticeStrip({
  markerPrimary,
  markerSecondary,
  markerIcon,
  headline,
  children,
  tone = "copper",
  role,
  className,
}: NoticeStripProps) {
  const headlineId = React.useId();
  return (
    <section
      role={role}
      aria-labelledby={headlineId}
      className={cn(
        "space-y-5 border-y bg-[var(--paper-2)] px-5 py-6 sm:px-7 sm:py-8",
        toneClasses[tone],
        className,
      )}
    >
      <div className="space-y-3">
        {markerIcon ? (
          <div className="flex items-center gap-2">
            {markerIcon}
            <SectionMarker
              primary={markerPrimary}
              secondary={markerSecondary}
            />
          </div>
        ) : (
          <SectionMarker primary={markerPrimary} secondary={markerSecondary} />
        )}
        <h2
          id={headlineId}
          className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-2xl"
        >
          {headline}
        </h2>
      </div>
      {children}
    </section>
  );
}
