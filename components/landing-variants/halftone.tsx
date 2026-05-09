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

    // Square halftone cells across the canvas (count scales with aspect).
    float cellsX = 56.0;
    vec2 cellSize = vec2(aspect / cellsX, 1.0 / (cellsX / aspect));
    vec2 cell = floor(uv / cellSize);
    vec2 cellCenter = (cell + 0.5) * cellSize;
    vec2 cellLocal = (uv - cellCenter) / cellSize;

    // A flowing noise field drives the cell amplitude.
    float n = fbm(cellCenter * 6.0 + vec2(uTime * 0.18, uTime * 0.12));
    n = (n + 1.0) * 0.5;

    // A diagonal traveling wave overlays the field so motion is undeniable.
    float wave =
      sin(cellCenter.x * 8.0 + cellCenter.y * 5.0 - uTime * 1.6) * 0.5 + 0.5;

    float amount = mix(n, wave, 0.45);
    float radius = 0.08 + 0.42 * amount;

    float d = length(cellLocal);
    float dot = 1.0 - smoothstep(radius - 0.06, radius, d);

    // Color the dot by amplitude — ink for most, teal for hot peaks,
    // copper for the very brightest.
    vec3 dotColor = INK;
    dotColor = mix(dotColor, TEAL,   smoothstep(0.55, 0.85, amount));
    dotColor = mix(dotColor, COPPER, smoothstep(0.85, 1.05, amount));

    vec3 color = PAPER;
    color = mix(color, dotColor, dot * 0.65);

    // A wide acid wash from the noise field that lives beneath the dots
    // so the page never goes truly empty between pulses.
    float wash = smoothstep(0.55, 1.0, n);
    color = mix(color, ACID, wash * 0.10);

    // Fade the whole pattern out toward the left rail so the editorial
    // column reads on clean paper while the right half stays full-density.
    float editorialFade = smoothstep(0.32, 0.58, uv.x);
    color = mix(PAPER, color, editorialFade);

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
 * Rendition 04 — Halftone Pulse.
 * A 56-wide grid of dots whose radius is driven by a flowing noise
 * field and a diagonal traveling wave; reads like a printing press
 * coming to life. Editorial split layout: small label + big headline +
 * supporting paragraph + sign-in stacked along the left rail.
 */
export function HalftoneVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-6 top-6 z-20">
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

      <div className="pointer-events-none absolute right-6 top-6 z-20 hidden font-mono text-[10px] uppercase leading-relaxed tracking-[0.28em] text-[var(--ink-muted)] sm:block">
        <div>USM · CSS · 2026</div>
        <div className="mt-1">edition 14</div>
      </div>

      <section className="container-wide relative z-20 grid min-h-[100dvh] grid-cols-1 items-center gap-12 py-32 lg:grid-cols-12">
        <div className="lg:col-span-6 xl:col-span-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
            Edition 14 · vol. 02
          </span>
          <h1 className="font-display mt-6 text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.94] tracking-[-0.04em] text-[var(--ink)]">
            Every dot
            <br />
            counts.
          </h1>
          <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-[var(--ink-muted)]">
            One member. One vote. The Annual General Meeting compresses an
            entire year of CSS into a printable, transparent record.
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
          rendition · 04 / halftone pulse
        </p>
      </footer>
    </main>
  );
}
