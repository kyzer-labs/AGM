"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { GrainOverlay } from "@/components/landing/grain-overlay";
import { SignInCTA } from "@/components/landing/sign-in-cta";
import {
  SHADER_HEADER,
  SHADER_NOISE,
  SHADER_PALETTE,
} from "@/components/landing-variants/_shared/shader-prelude";

const FRAGMENT = `
  ${SHADER_HEADER}
  ${SHADER_NOISE}
  ${SHADER_PALETTE}

  // Drift Mist — a single domain-warped low-frequency noise field that
  // drifts slowly. Maps the noise to barely-there warm/cool tints over
  // paper. No isobars, no shapes; just a quiet atmosphere that breathes
  // behind the content.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.06;

    vec2 w1 = vec2(
      fbm(q * 0.7 + vec2(t, 0.0)),
      fbm(q * 0.7 + vec2(5.2, t))
    );
    vec2 warpedQ = q + w1 * 0.45;

    float n = fbm(warpedQ * 0.45 + vec2(t * 0.6, t * 0.4));

    float warm = smoothstep(0.00,  0.65, n);
    float cool = smoothstep(0.00, -0.65, n);

    vec3 color = PAPER;
    color = mix(color, ACID, warm * 0.10);
    color = mix(color, TEAL, cool * 0.08);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const OglCanvas = dynamic(
  () =>
    import("@/components/landing-variants/_shared/ogl-canvas").then(
      (m) => m.OglCanvas,
    ),
  { ssr: false },
);

/**
 * Rendition 02 — Drift Mist.
 * The quietest of the set: a low-contrast warm/cool wash drifting on a
 * domain-warped noise field. Editorial left-aligned hero with a wide
 * empty right column for breath.
 */
export function DriftMistVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-6 top-6 z-20 sm:left-10">
        <div className="surface-glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2">
          <Image
            src="/logos/cs-soc-official.svg"
            alt=""
            width={22}
            height={22}
            priority
            className="h-[22px] w-[22px]"
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink)]">
            USM CSS AGM
          </span>
        </div>
      </div>

      <section className="container-wide relative z-20 grid min-h-[100dvh] grid-cols-1 items-center gap-12 py-32 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
            session 25 / 26 · annual general meeting
          </span>
          <h1 className="font-display mt-8 text-[clamp(2.75rem,7.5vw,7rem)] leading-[0.96] tracking-[-0.04em] text-[var(--ink)]">
            A quiet door
            <br />
            to a public room.
          </h1>
          <p className="mt-8 max-w-[44ch] text-base leading-relaxed text-[var(--ink-muted)]">
            Sign in with your @student.usm.my Microsoft account. The portal
            will route you to whatever the AGM needs from you next &mdash;
            evaluation, voting, or simply the result.
          </p>
          <div className="mt-10">
            <SignInCTA />
          </div>
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 02 / drift mist
        </p>
      </footer>
    </main>
  );
}
