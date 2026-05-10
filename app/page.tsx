import Image from "next/image";
import { LandingBackdrop } from "@/components/landing/landing-backdrop";
import { LandingRedirect } from "@/components/landing/landing-redirect";
import { SignInCTA } from "@/components/landing/sign-in-cta";

// AGM cycle year. Lives here as a single named constant so next year's
// committee changes one value and rebuilds. The brief allows either this
// or a Convex-sourced value; a Convex query for one number that changes
// once a year would be wasteful for a marketing surface that already
// renders before any auth handshake has happened.
const AGM_CYCLE_YEAR = 2026;

/**
 * USM CSS AGM portal — locked landing.
 *
 * Implements docs/landing-rendition-brief.md. Single-viewport, symmetric
 * centered layout. The backdrop is the visual anchor; the headline is
 * the intellectual anchor; the CTA is the only meaningful action.
 *
 * Key brief commitments honored here:
 *  - Sumi-e composition rendered as a static asset instead of a live
 *    shader (decision recorded in the brief's "Decision update" section).
 *  - Brand pill is solid-surface outlined, not glass (anti-goal:
 *    no_glass_brand_pill).
 *  - CTA reuses the shared SignInCTA, not a custom Microsoft-branded
 *    button (anti-goal: no_microsoft_mark).
 *  - No grain overlay anywhere in the tree (anti-goal: no_grain_overlay).
 *  - prefers-reduced-motion is trivially satisfied: the backdrop is a
 *    static image, no motion to reduce.
 *  - WebGL-unavailable fallback is no longer a concern: there is no
 *    WebGL. If the asset fails to load (slow conference WiFi),
 *    next/image's own fallback shows transparent pixels; the cream
 *    paper body background and the headline / CTA stay legible.
 *  - Cycle year and eligibility are both visible above the fold so a
 *    voter on AGM day knows which year and whether they qualify before
 *    they tap.
 *
 * Server-rendered: no `use client` needed. The CTA and the
 * `LandingRedirect` side-effect are the only client components on this
 * surface. `LandingRedirect` watches Firebase auth state and punts any
 * already-authenticated visitor (revisit, refresh, or just-completed
 * sign-in popup) to `/dashboard`, which encodes the role-aware and
 * phase-aware routing for every downstream surface.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <LandingRedirect />
      <LandingBackdrop />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex justify-center px-6 pt-8 sm:pt-10">
          <BrandPill year={AGM_CYCLE_YEAR} />
        </header>

        <section className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
          <h1
            className={[
              "font-serif",
              "text-[clamp(2rem,7.2vw,5.5rem)]",
              "font-medium",
              "leading-[1.02] sm:leading-[0.98]",
              "tracking-[-0.012em]",
              "text-[var(--ink)]",
            ].join(" ")}
          >
            Elect the next
            <br />
            CSS committee.
          </h1>

          <div className="mt-12">
            <SignInCTA />
          </div>

          <p
            className={[
              "mt-7",
              "font-mono",
              "text-[10.5px]",
              "uppercase",
              "tracking-[0.28em]",
              "text-[var(--ink-muted)]",
            ].join(" ")}
          >
            @student.usm.my accounts only
          </p>
        </section>

        <footer className="flex items-end justify-between gap-4 px-6 pb-6 sm:px-8 sm:pb-8">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.20em] text-[var(--ink-muted)]">
            USM Computer Science Society
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.20em] text-[var(--ink-muted)]">
            AGM {AGM_CYCLE_YEAR}
          </p>
        </footer>
      </div>
    </main>
  );
}

interface BrandPillProps {
  year: number;
}

/**
 * Top-center brand identity capsule. Outlined ink-on-paper at 88 percent
 * opacity (no backdrop blur, no glass). Includes the cycle year inline
 * because the brief makes the year part of canonical identity, not
 * supporting metadata.
 */
function BrandPill({ year }: BrandPillProps) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2.5",
        "rounded-full",
        "border border-[var(--ink)]",
        "bg-[var(--paper)]/88",
        "px-4 py-2",
      ].join(" ")}
    >
      <Image
        src="/logos/cs-soc-official.svg"
        alt=""
        width={20}
        height={20}
        priority
        className="h-[20px] w-[20px]"
        aria-hidden
      />
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-[var(--ink)]">
        USM CSS AGM <span className="text-[var(--copper)]">·</span> {year}
      </span>
    </div>
  );
}
