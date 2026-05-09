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

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime;

    // Domain warp: sample noise at a position that itself flows through
    // another noise field. Produces visibly drifting organic shapes with
    // no fixed origin / "root" edge.
    vec2 w1 = vec2(
      fbm(q * 0.85 + vec2(t * 0.10, 0.0)),
      fbm(q * 0.85 + vec2(5.2, t * 0.10))
    );
    vec2 warpedQ = q + w1 * 0.65;

    float n = fbm(warpedQ * 0.55 + vec2(t * 0.07, t * 0.05));

    float warm  = smoothstep(0.00,  0.55, n);
    float cool  = smoothstep(0.00, -0.55, n);
    float spark = smoothstep(0.55,  0.95, n);

    vec3 color = PAPER;
    color = mix(color, ACID,   warm  * 0.55);
    color = mix(color, TEAL,   cool  * 0.42);
    color = mix(color, COPPER, spark * 0.22);

    float pulse = 0.5 + 0.5 * sin(t * 0.5);
    color = mix(color, ACID, pulse * spark * 0.18);

    float major = abs(fract(n * 2.5 + 0.5) - 0.5);
    float majorMask = 1.0 - smoothstep(0.020, 0.090, major);
    color = mix(color, INK, majorMask * 0.42);

    float minor = abs(fract(n * 7.0 + 0.5) - 0.5);
    float minorMask = 1.0 - smoothstep(0.005, 0.020, minor);
    color = mix(color, INK, minorMask * 0.14);

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
 * Rendition 01 — Aurora Drift.
 * Editorial premium: domain-warped acid / teal / copper aurora with low
 * frequency ink isobars. Left-aligned hero, brand pill top center.
 */
export function AuroraVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2">
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

      <section className="container-narrow relative z-20 flex min-h-[100dvh] flex-col justify-center py-32">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          USM CSS · annual general meeting
        </span>
        <h1 className="font-display mt-6 text-[clamp(2.75rem,8vw,7rem)] leading-[0.95] tracking-[-0.04em] text-[var(--ink)]">
          Elect the next CSS committee.
        </h1>
        <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Sign in with your @student.usm.my Microsoft account to continue.
        </p>
        <div className="mt-10">
          <SignInCTA />
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 01 / aurora drift
        </p>
      </footer>
    </main>
  );
}
