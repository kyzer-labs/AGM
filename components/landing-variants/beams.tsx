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
    vec2 c = uv - 0.5;
    c.x *= uResolution.x / uResolution.y;

    float r = length(c);
    float angle = atan(c.y, c.x);

    float t = uTime;

    // Slow primary beams — five lobes, soft falloff toward the rim.
    float beam = sin(angle * 5.0 + t * 0.18) * 0.5 + 0.5;
    beam = pow(beam, 4.0);
    beam *= smoothstep(0.95, 0.05, r);

    // Counter-rotating tighter beam set.
    float beam2 = sin(angle * 7.0 - t * 0.13 + 1.57) * 0.5 + 0.5;
    beam2 = pow(beam2, 6.0);
    beam2 *= smoothstep(0.75, 0.10, r);

    // Concentric rings expanding outward — radial pulse.
    float pulse = sin(r * 14.0 - t * 1.4) * 0.5 + 0.5;
    pulse = pow(pulse, 2.0);
    pulse *= smoothstep(0.95, 0.0, r);

    // Soft warm core that breathes.
    float breathe = 0.5 + 0.5 * sin(t * 0.4);
    float glow = exp(-r * 4.5) * (0.45 + 0.20 * breathe);

    // A faint noise haze layered over the rays so the field is not pure
    // geometry — adds tactile depth.
    float haze = fbm(c * 1.4 + vec2(t * 0.05));
    float hazeMask = smoothstep(0.0, 0.7, haze) * smoothstep(0.95, 0.20, r);

    vec3 color = PAPER;
    color = mix(color, ACID,   beam   * 0.45);
    color = mix(color, TEAL,   beam2  * 0.32);
    color = mix(color, INK,    pulse  * 0.18);
    color = mix(color, COPPER, glow);
    color = mix(color, TEAL,   hazeMask * 0.10);

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
 * Rendition 05 — Compass Beams.
 * Counter-rotating radial beams + concentric rings + a warm copper
 * core. Tightly centered ceremonial composition: small mark, single
 * declarative line, sign-in.
 */
export function BeamsVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <section className="container-narrow relative z-20 flex min-h-[100dvh] flex-col items-center justify-center py-32 text-center">
        <div className="surface-glass mb-10 flex items-center gap-2.5 rounded-full px-4 py-2">
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

        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-[var(--ink-muted)]">
          ⌘ assembly · 2026
        </span>

        <h1 className="font-display mt-8 text-[clamp(2.5rem,8vw,7rem)] leading-[0.92] tracking-[-0.045em] text-[var(--ink)]">
          Set the
          <br />
          <span className="text-[var(--copper)]">course.</span>
        </h1>

        <p className="mt-8 max-w-[36ch] text-sm leading-relaxed text-[var(--ink-muted)]">
          The committee you elect will steer USM CSS for the next session.
          Sign in to participate.
        </p>

        <div className="mt-10">
          <SignInCTA />
        </div>

        <div className="mt-16 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          <span>nominate</span>
          <span aria-hidden>·</span>
          <span>evaluate</span>
          <span aria-hidden>·</span>
          <span>vote</span>
          <span aria-hidden>·</span>
          <span>publish</span>
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 05 / compass beams
        </p>
      </footer>
    </main>
  );
}
