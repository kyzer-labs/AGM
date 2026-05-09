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

  // Marbled Veins — domain-warped noise drives flowing teal swathes that
  // are heavily edge-weighted, so they pour in from the rim and the
  // headline area in the middle stays on clean paper. Fine copper
  // hairlines trace the noise isobars (only inside the teal mask), and
  // a sparse hash field flares small acid-yellow sparkles every few
  // seconds. Slow drift speeds throughout.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.07;

    // Heavy domain warp for organic marbling.
    vec2 w1 = vec2(
      fbm(q * 0.6 + vec2(t, 0.0)),
      fbm(q * 0.6 + vec2(5.2, t))
    );
    vec2 w2 = vec2(
      fbm(q * 1.2 + 2.5 * w1),
      fbm(q * 1.2 + 2.5 * w1 + vec2(2.3))
    );
    vec2 wq = q + w2 * 0.7;

    float n = fbm(wq * 0.50 + vec2(t * 0.5, t * 0.3));

    // Edge-weight mask: 0 in the centre, ramps up toward the corners.
    // Aspect-corrected so the centre is roughly oval, not stretched.
    // Pushed further out so the headline area stays clean paper while
    // the swathes feel decisively rim-anchored — closer to the
    // reference render.
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    float r = length(c) * 1.25;
    float edgeWeight = smoothstep(0.28, 0.95, r);

    // Soft teal mask, only where noise is positive.
    float tealMask = smoothstep(0.00, 0.55, n) * edgeWeight;

    vec3 color = PAPER;
    color = mix(color, TEAL, tealMask * 0.65);

    // Copper hairline veins on isobars — only where the teal exists, so
    // the centre paper stays uncluttered.
    float vein = abs(fract(n * 4.0 + 0.5) - 0.5);
    float veinMask = 1.0 - smoothstep(0.004, 0.018, vein);
    color = mix(color, COPPER, veinMask * tealMask * 0.70);

    // A barely-there secondary cool wash so the teal looks like it sits
    // on a cooler bed rather than appearing on raw paper.
    float cool = smoothstep(0.0, -0.7, n);
    color = mix(color, TEAL, cool * edgeWeight * 0.14);

    // Sparkle dots: a sparse hash grid; very few cells are lit, and each
    // pulses on a slow sine offset by the cell hash so they never blink
    // in unison.
    vec2 spCellSize = vec2(1.0 / 35.0);
    vec2 spCell = floor(uv / spCellSize);
    vec2 spLocal = fract(uv / spCellSize) - 0.5;
    float spHash =
      fract(sin(dot(spCell, vec2(12.9898, 78.233))) * 43758.5453);
    float spOn = step(0.985, spHash);
    float spDist = length(spLocal);
    float spDot = 1.0 - smoothstep(0.06, 0.18, spDist);
    float spPulse = 0.5 + 0.5 * sin(uTime * 1.6 + spHash * 60.0);
    float sparkle = spOn * spDot * spPulse * edgeWeight;
    color = mix(color, ACID, sparkle * 0.55);

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
 * Rendition 02 — Marbled Veins.
 * Edge-weighted teal swathes flow inward like watercolor on wet paper,
 * with fine copper hairlines tracing the noise isobars and sparse acid
 * sparkles drifting through them. Symmetric centered hero so the clear
 * paper centre frames the headline.
 */
export function MarbledVariant() {
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
        <h1 className="font-display text-[clamp(2.75rem,8.5vw,7.5rem)] leading-[0.94] tracking-[-0.045em] text-[var(--ink)]">
          Elect the next
          <br />
          CSS committee.
        </h1>

        <div className="mt-12">
          <SignInCTA />
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-8 z-20 flex justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
      </footer>

      <p className="absolute bottom-3 right-6 z-20 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        rendition · 02 / marbled veins
      </p>
    </main>
  );
}
