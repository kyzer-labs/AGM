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

  // Iridescent Sheen — three palette tints (teal, copper, acid) cross-fade
  // through space and time according to a smooth domain-warped noise
  // field. The palette shift is very low intensity so the page reads as
  // a still piece of paper that quietly catches light from different
  // angles, like the inside of a shell or oil on water.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.05;

    vec2 w = vec2(
      fbm(q * 0.6 + vec2(t, 0.0)),
      fbm(q * 0.6 + vec2(11.1, t))
    );
    vec2 wq = q + w * 0.5;

    float n = fbm(wq * 0.45 + vec2(t * 0.7, t * 0.4));
    n = (n + 1.0) * 0.5;

    // Three smooth lobes spanning the unit interval. Their sum is ~1, so
    // the tints cross-fade rather than stack.
    float wTeal   = exp(-pow((n - 0.25) * 4.5, 2.0));
    float wCopper = exp(-pow((n - 0.55) * 4.5, 2.0));
    float wAcid   = exp(-pow((n - 0.85) * 4.5, 2.0));

    vec3 color = PAPER;
    color = mix(color, TEAL,   wTeal   * 0.10);
    color = mix(color, COPPER, wCopper * 0.08);
    color = mix(color, ACID,   wAcid   * 0.10);

    // A single very slow breath on the whole field so the user gets a
    // hint of life if they linger.
    float breath = 0.5 + 0.5 * sin(uTime * 0.20);
    color = mix(color, color * 1.02, breath * 0.5);

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
 * Rendition 05 — Iridescent Sheen.
 * Three palette tints cross-fading on a slow noise field — like oil on
 * water or the inside of a shell. Asymmetric editorial: brand top-left,
 * meta tag top-right, big headline center-right, supporting copy under
 * it.
 */
export function IridescentVariant() {
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

      <div className="pointer-events-none absolute right-6 top-6 z-20 hidden font-mono text-[10px] uppercase leading-relaxed tracking-[0.28em] text-[var(--ink-muted)] sm:block">
        <div className="text-right">session 25 / 26</div>
        <div className="mt-1 text-right">annual general meeting</div>
      </div>

      <section className="container-wide relative z-20 grid min-h-[100dvh] grid-cols-1 items-center py-32 lg:grid-cols-12">
        <div className="lg:col-span-2" aria-hidden />
        <div className="lg:col-span-9 xl:col-span-8">
          <h1 className="font-display text-[clamp(3rem,9vw,8rem)] leading-[0.92] tracking-[-0.045em] text-[var(--ink)]">
            Open the doors
            <br />
            to <span className="text-[var(--teal)]">AGM 2026</span>.
          </h1>
          <p className="mt-8 max-w-[44ch] text-base leading-relaxed text-[var(--ink-muted)]">
            Nominations, internal evaluation, and the public vote run on
            this single portal. Sign in once, see only what concerns you.
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
          rendition · 05 / iridescent sheen
        </p>
      </footer>
    </main>
  );
}
