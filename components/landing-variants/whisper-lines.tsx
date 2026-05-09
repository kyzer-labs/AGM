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

  // Whisper Lines — a domain-warped fine line pattern reads as paper
  // texture, not as graphics. Lines are high-frequency (~30 across the
  // viewport) and very low contrast; you only notice them once you
  // start looking for them.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.08;

    vec2 w = vec2(
      fbm(q * 0.55 + vec2(t, 0.0)),
      fbm(q * 0.55 + vec2(7.3, t))
    ) * 0.45;
    vec2 wq = q + w;

    // Fine diagonal stripes — pull the line out at the sine zero crossing
    // so each line is a sharp thin hairline, then mix at near-paper alpha.
    float s = sin(wq.x * 30.0 + wq.y * 18.0);
    float lineMask = 1.0 - smoothstep(0.0, 0.18, abs(s));

    // A barely-there teal mist so the page is not flat between lines.
    float tint = fbm(q * 0.4 + vec2(t * 0.6));

    vec3 color = PAPER;
    color = mix(color, TEAL, smoothstep(0.0, 0.7, tint) * 0.04);
    color = mix(color, INK,  lineMask * 0.025);

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
 * Rendition 04 — Whisper Lines.
 * Domain-warped sine waves drawn in the faintest possible ink, layered
 * over a near-imperceptible teal wash. Bottom-left anchored composition
 * with deliberate empty top — like a film poster where the type sits
 * low and the air above does the heavy lifting.
 */
export function WhisperLinesVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <div className="pointer-events-none absolute right-6 top-6 z-20 sm:right-10">
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

      <section className="container-wide relative z-20 flex min-h-[100dvh] flex-col justify-end pb-32 pt-32">
        <div className="max-w-[58rem]">
          <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
            usm css · agm 2026 · sign in
          </span>
          <h1 className="font-display mt-6 text-[clamp(3.5rem,11vw,9rem)] leading-[0.88] tracking-[-0.05em] text-[var(--ink)]">
            Sign in.
            <br />
            Vote.
            <br />
            <span className="italic text-[var(--copper)]">Steer.</span>
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <SignInCTA />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
              @student.usm.my only
            </span>
          </div>
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 04 / whisper lines
        </p>
      </footer>
    </main>
  );
}
