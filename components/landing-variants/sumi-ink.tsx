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

  // Sumi-e Drift — soft graphite ink shapes pour in from the corners.
  // Inside each ink mass we sample a high-frequency directional sin
  // pattern aligned with the warped noise to read as brush-hair texture.
  // Sparse copper hairlines drift along the edges of the ink, like the
  // rust accents in the reference image. The composition stays clear
  // through the centre so the headline feels like it sits on a pristine
  // sheet of paper.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.05;

    // Two-pass domain warp.
    vec2 w1 = vec2(
      fbm(q * 0.7 + vec2(t)),
      fbm(q * 0.7 + vec2(7.3, t))
    );
    vec2 w2 = vec2(
      fbm(q * 1.3 + 2.4 * w1),
      fbm(q * 1.3 + 2.4 * w1 + vec2(2.3))
    );
    vec2 wq = q + w2 * 0.65;

    float n = fbm(wq * 0.45 + vec2(t * 0.4));

    // Edge weight pushes the ink to the corners and keeps the centre
    // open. Stronger ramp than the marbled variant — sumi-e wants more
    // negative space.
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    float r = length(c) * 1.1;
    float edgeWeight = smoothstep(0.25, 0.95, r);

    // Smooth ink mask. Multiply by edge weight so the ink reads as
    // brushed-in from the rim.
    float inkMask = smoothstep(-0.05, 0.65, n) * edgeWeight;

    vec3 color = PAPER;

    // Soft graphite wash.
    color = mix(color, INK, inkMask * 0.28);

    // Brush-hair texture inside the ink: medium-frequency sine following
    // the warped coords so lines feel like they curve along the brush
    // motion. Phase shifted by the noise field so the bristles flow
    // with the wash rather than reading as a regular grating.
    float lines = sin(wq.x * 30.0 + wq.y * 14.0 + n * 14.0);
    float brush = 1.0 - smoothstep(0.05, 0.30, abs(lines));
    color = mix(color, INK, brush * inkMask * 0.32);

    // Copper accent traces on isobars — thinner and more selective so
    // they read as occasional drift lines, not contour shading.
    float trace = abs(fract(n * 3.5 + 0.5) - 0.5);
    float traceMask = 1.0 - smoothstep(0.003, 0.012, trace);
    // Bias copper to mid-range noise so it sits at the boundary of the
    // ink where it's most visible.
    float traceGate = smoothstep(0.20, 0.45, n) *
                      (1.0 - smoothstep(0.65, 0.85, n));
    color = mix(
      color,
      COPPER,
      traceMask * traceGate * edgeWeight * 0.45
    );

    // Tiny ink speckle — like splattered drops. Very sparse hash field.
    vec2 spCellSize = vec2(1.0 / 60.0);
    vec2 spCell = floor(uv / spCellSize);
    vec2 spLocal = fract(uv / spCellSize) - 0.5;
    float spHash =
      fract(sin(dot(spCell, vec2(91.345, 47.853))) * 21459.1234);
    float spOn = step(0.992, spHash);
    float spDist = length(spLocal);
    float spDot = 1.0 - smoothstep(0.10, 0.25, spDist);
    color = mix(color, INK, spOn * spDot * edgeWeight * 0.35);

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
 * Rendition 03 — Sumi-e Drift.
 * Soft graphite ink shapes drift in from the corners with brush-hair
 * line texture inside, threaded with copper hairlines on the ink
 * boundary. Symmetric centered hero with the brand pill at the top, the
 * AGM signature low on the right.
 */
export function SumiInkVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2">
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
        <h1 className="font-display text-[clamp(2.5rem,7.8vw,6.75rem)] leading-[0.96] tracking-[-0.045em] text-[var(--ink)]">
          Elect the next
          <br />
          CSS committee.
        </h1>

        <div className="mt-12">
          <SignInCTA />
        </div>
      </section>

      <p className="absolute bottom-6 right-8 z-20 font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
        USM Computer Science Society <span className="text-[var(--copper)]">/</span>
      </p>

      <p className="absolute bottom-3 left-6 z-20 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        rendition · 03 / sumi-e drift
      </p>
    </main>
  );
}
