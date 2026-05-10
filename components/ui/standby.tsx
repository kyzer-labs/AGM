import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionMarker } from "@/components/ui/section-marker";

export interface StandbyProps {
  /**
   * SectionMarker primary part — the page-level prefix, e.g. "Standby",
   * "Internal evaluation", "AGM voting", "Final results".
   */
  markerPrimary: ReactNode;
  /**
   * SectionMarker secondary part — usually the phase or sub-state
   * label. Optional so single-label markers stay clean.
   */
  markerSecondary?: ReactNode;
  /**
   * Cycle name shown as the editorial h1. When null, the headline
   * falls back to "No active AGM cycle" so the surface still has a
   * usable title bar before any cycle is created.
   */
  cycleName: string | null;
  /**
   * Body paragraph under the headline. Typed as ReactNode so call
   * sites can splice in inline emphasis without losing the wrapping
   * paragraph treatment.
   */
  body: ReactNode;
  /**
   * Slot for additional content after the header — Meta groups,
   * status footers, pulsing-dot rows. Rendered as a sibling of
   * `<header>` inside the same `<main>` so consumers keep full
   * control of vertical rhythm.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * Editorial Standby block used by every voter-facing page when its
 * surface is awaiting a phase change. Composes a SectionMarker, an
 * h1 cycle headline (with the "No active AGM cycle" fallback), a body
 * paragraph, and an optional slot for additional content (MetaGroup,
 * live-status row, etc).
 *
 * The container is a `<main>` so this is a top-level surface, not a
 * nested fragment; pages must not wrap it in another `<main>`.
 */
export function Standby({
  markerPrimary,
  markerSecondary,
  cycleName,
  body,
  children,
  className,
}: StandbyProps) {
  return (
    <main className={cn("container-narrow py-20 sm:py-24", className)}>
      <header className="space-y-4">
        <SectionMarker primary={markerPrimary} secondary={markerSecondary} />
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {cycleName ?? "No active AGM cycle"}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {body}
        </p>
      </header>
      {children}
    </main>
  );
}
