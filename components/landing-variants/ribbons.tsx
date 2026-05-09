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

  // A horizontal ribbon at baseY, displaced by a sum of two noise samples
  // so it flutters like silk. Returns a 0..1 mask centred on the ribbon.
  float ribbon(vec2 q, float baseY, float speed, float thickness, float amp) {
    float displace =
      snoise(vec2(q.x * 1.2, uTime * speed)) * amp +
      snoise(vec2(q.x * 3.0, uTime * speed * 0.6)) * amp * 0.4;
    float dist = abs(q.y - baseY - displace);
    float core = 1.0 - smoothstep(0.0, thickness, dist);
    float halo = 1.0 - smoothstep(thickness, thickness * 5.0, dist);
    return core + halo * 0.30;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    vec3 color = PAPER;

    // Four ribbons of distinct colors at different y positions, speeds,
    // and thicknesses — composited additively over the paper base.
    float r1 = ribbon(q, 0.18, 0.30, 0.045, 0.12);
    float r2 = ribbon(q, 0.42, 0.45, 0.030, 0.18);
    float r3 = ribbon(q, 0.66, 0.20, 0.055, 0.10);
    float r4 = ribbon(q, 0.85, 0.50, 0.025, 0.20);

    color = mix(color, TEAL,   clamp(r1 * 0.55, 0.0, 1.0));
    color = mix(color, ACID,   clamp(r2 * 0.65, 0.0, 1.0));
    color = mix(color, COPPER, clamp(r3 * 0.50, 0.0, 1.0));
    color = mix(color, INK,    clamp(r4 * 0.55, 0.0, 1.0));

    // Faint vertical scan to add a subtle directional shimmer.
    float scan = sin(q.x * 60.0 + uTime * 0.8) * 0.02;
    color += scan;

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
 * Rendition 02 — Liquid Ribbons.
 * Four horizontal silk bands fluttering across the canvas. Centered hero,
 * tall display type, sign-in pinned below the headline.
 */
export function RibbonsVariant() {
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

      <section className="container-narrow relative z-20 flex min-h-[100dvh] flex-col items-center justify-center py-28 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          Session 25 / 26 — committee election
        </span>
        <h1 className="font-display mt-8 text-[clamp(3rem,9vw,8rem)] leading-[0.92] tracking-[-0.045em] text-[var(--ink)]">
          Many threads.
          <br />
          <span className="italic text-[var(--teal)]">One society.</span>
        </h1>
        <p className="mt-8 max-w-[44ch] text-base leading-relaxed text-[var(--ink-muted)]">
          The Annual General Meeting opens nominations, evaluations, and the
          public vote — woven together over a single weekend.
        </p>
        <div className="mt-12">
          <SignInCTA />
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 02 / liquid ribbons
        </p>
      </footer>
    </main>
  );
}
