import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionMarkerProps {
  /** First label, e.g. "Standby", "Internal evaluation", "Final results". */
  primary: ReactNode;
  /**
   * Optional second label, joined to `primary` by a copper middle-dot.
   * Pass any ReactNode to compose richer markers (a third part, a time
   * stamp, etc.) — see usage notes below.
   */
  secondary?: ReactNode;
  className?: string;
}

/**
 * Mono section-marker used as the leading metadata strip on every
 * voter-facing page header. Renders as `Primary · Secondary` where the
 * dot is in copper, matching the landing's brand pill so the whole
 * portal speaks one mark of identity.
 *
 * Two-part usage:
 *   <SectionMarker primary="Standby" secondary="Internal evaluation open" />
 *
 * Three-part usage: compose the secondary slot with a nested copper
 * dot, so the second separator stays visually consistent:
 *   <SectionMarker
 *     primary="Live ballot"
 *     secondary={
 *       <>
 *         Tier {tier}{" "}
 *         <span aria-hidden className="text-[var(--copper)]">·</span>{" "}
 *         Opened {time}
 *       </>
 *     }
 *   />
 */
export function SectionMarker({
  primary,
  secondary,
  className,
}: SectionMarkerProps) {
  return (
    <p
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--ink-muted)]",
        className,
      )}
    >
      {primary}
      {secondary !== undefined ? (
        <>
          {" "}
          <span aria-hidden className="text-[var(--copper)]">
            ·
          </span>{" "}
          {secondary}
        </>
      ) : null}
    </p>
  );
}
