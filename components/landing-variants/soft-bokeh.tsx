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

  // A wide soft falloff — squared smoothstep so the orb has a long, gentle
  // halo without any visible edge.
  float orb(vec2 p, vec2 c, float r) {
    float d = length(p - c);
    float v = smoothstep(r, 0.0, d);
    return v * v;
  }

  // Soft Bokeh — five large blurred orbs drift in lazy circles across the
  // canvas. Their centers move every frame, so the eye never finds a fixed
  // origin; their falloff is wide enough that the page never looks like a
  // bright dot on a paper background.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime;
    float a = aspect;

    vec2 c1 = vec2(0.30 * a + sin(t * 0.05) * 0.18 * a,
                   0.40        + cos(t * 0.07) * 0.14);
    vec2 c2 = vec2(0.72 * a + sin(t * 0.06 + 1.5) * 0.14 * a,
                   0.60        + cos(t * 0.08 + 2.0) * 0.18);
    vec2 c3 = vec2(0.50 * a + sin(t * 0.04 + 3.0) * 0.22 * a,
                   0.18        + cos(t * 0.06 + 1.0) * 0.10);
    vec2 c4 = vec2(0.18 * a + sin(t * 0.07 + 2.0) * 0.14 * a,
                   0.85        + cos(t * 0.05 + 0.5) * 0.10);
    vec2 c5 = vec2(0.85 * a + sin(t * 0.05 + 4.0) * 0.10 * a,
                   0.30        + cos(t * 0.06 + 2.5) * 0.12);

    float o1 = orb(q, c1, 0.55);
    float o2 = orb(q, c2, 0.50);
    float o3 = orb(q, c3, 0.62);
    float o4 = orb(q, c4, 0.48);
    float o5 = orb(q, c5, 0.45);

    vec3 color = PAPER;
    color = mix(color, ACID,   o1 * 0.13);
    color = mix(color, TEAL,   o2 * 0.11);
    color = mix(color, COPPER, o3 * 0.09);
    color = mix(color, ACID,   o4 * 0.08);
    color = mix(color, TEAL,   o5 * 0.10);

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

const PHASES = ["nominate", "evaluate", "vote", "publish"] as const;

/**
 * Rendition 03 — Soft Bokeh.
 * Five large blurred orbs drift in lazy circles. Out-of-focus
 * photography vibe. Fully centered composition with a small AGM phase
 * pipeline beneath the CTA so the page feels grounded even with a quiet
 * background.
 */
export function SoftBokehVariant() {
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

      <section className="container-narrow relative z-20 flex min-h-[100dvh] flex-col items-center justify-center py-32 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          session 25 / 26
        </span>
        <h1 className="font-display mt-8 text-[clamp(2.5rem,7.5vw,6.5rem)] leading-[0.95] tracking-[-0.04em] text-[var(--ink)]">
          The 2026 committee
          <br />
          <span className="text-[var(--teal)]">starts here.</span>
        </h1>
        <p className="mt-8 max-w-[40ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Sign in with your @student.usm.my Microsoft account to take part
          in this year&rsquo;s Annual General Meeting.
        </p>
        <div className="mt-10">
          <SignInCTA />
        </div>

        <ol className="mt-16 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          {PHASES.map((phase, idx) => (
            <li key={phase} className="flex items-center gap-3">
              <span>{phase}</span>
              {idx < PHASES.length - 1 && (
                <span aria-hidden className="text-[var(--ink-line)]">
                  &middot;
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 03 / soft bokeh
        </p>
      </footer>
    </main>
  );
}
