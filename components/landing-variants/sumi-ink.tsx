"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { GrainOverlay } from "@/components/landing/grain-overlay";
import { useMicrosoftSignIn } from "@/components/auth/use-microsoft-signin";
import {
  SHADER_HEADER,
  SHADER_NOISE,
  SHADER_PALETTE,
} from "@/components/landing-variants/_shared/shader-prelude";
import { cn } from "@/lib/utils";

const FRAGMENT = `
  ${SHADER_HEADER}
  ${SHADER_NOISE}
  ${SHADER_PALETTE}

  // Sumi-e Drift — light, atmospheric ink-wash billows are CONCENTRATED
  // in the top-right and bottom-left corners with much lighter wisps in
  // the opposite corners. Long, calligraphic copper threads weave through
  // smoke and open paper. Subtle paper-fiber texture everywhere. The
  // center stays clean cream so the headline is the lone anchor.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.025;

    vec2 w1 = vec2(
      fbm(q * 0.55 + vec2(t)),
      fbm(q * 0.55 + vec2(7.3, t))
    );
    vec2 w2 = vec2(
      fbm(q * 1.05 + 1.3 * w1),
      fbm(q * 1.05 + 1.3 * w1 + vec2(2.3))
    );
    vec2 wq = q + w2 * 0.42;

    float nLow = fbm(wq * 0.45 + vec2(t * 0.4));

    // Per-corner cloud strengths. Use UV-space distances so corners are
    // at fixed positions regardless of aspect; warp the field with fbm
    // so the cloud edge is organic. Primary clouds (TR + BL) are larger
    // and more saturated than the secondary wisps (TL + BR).
    float warpA = fbm(wq * 1.20 + vec2(t * 0.6)) * 0.34;
    float warpB = fbm(wq * 1.20 + vec2(8.7, t * 0.4)) * 0.28;

    float dTR = distance(uv, vec2(1.0, 1.0));
    float dBL = distance(uv, vec2(0.0, 0.0));
    float dTL = distance(uv, vec2(0.0, 1.0));
    float dBR = distance(uv, vec2(1.0, 0.0));

    float cloudTR = smoothstep(0.88, 0.08, dTR + warpA) *
                    (0.70 + fbm(wq * 1.5) * 0.90) * 1.15;
    float cloudBL = smoothstep(0.88, 0.08, dBL + warpA) *
                    (0.70 + fbm(wq * 1.5 + vec2(11.7)) * 0.90) * 1.15;
    float cloudTL = smoothstep(0.55, 0.18, dTL + warpB) *
                    (0.32 + fbm(wq * 1.6 + vec2(3.7)) * 0.45) * 0.32;
    float cloudBR = smoothstep(0.55, 0.18, dBR + warpB) *
                    (0.32 + fbm(wq * 1.6 + vec2(15.2)) * 0.45) * 0.32;

    float smokeMask = clamp(
      cloudTR + cloudBL + cloudTL + cloudBR,
      0.0,
      1.0
    );

    // Wide rectangular center clearing — keep type area calm without
    // looking like a circular vignette.
    vec2 c = uv - 0.5;
    float clearH = smoothstep(0.10, 0.34, abs(c.x));
    float clearV = smoothstep(0.05, 0.20, abs(c.y));
    float centerClear = clamp(max(clearH * 0.85 + clearV * 0.30, clearV), 0.0, 1.0);
    smokeMask *= centerClear;

    // Soft graphite-pencil shading inside the smoke — fine and breathy
    // so it reads as ink wash rather than a hatched grid.
    float hatchA = sin(wq.x * 60.0 + wq.y * 22.0 + fbm(wq * 2.0) * 3.5);
    float hatch = 1.0 - smoothstep(0.05, 0.32, abs(hatchA));

    vec3 paper        = PAPER;
    vec3 graphite     = vec3(0.74, 0.76, 0.79);
    vec3 graphiteDeep = vec3(0.46, 0.49, 0.54);
    vec3 smokeColor   = mix(graphite, graphiteDeep, hatch * 0.55);

    vec3 color = paper;
    color = mix(color, smokeColor, smokeMask * 0.48);

    // Long sweeping copper threads — thin and prominent, drawn nearly
    // everywhere on the canvas with only a mild gating preference for
    // smoke regions. This is the calligraphic line-work in the mock.
    float threadPhase = fbm(wq * 0.70 + vec2(t * 0.5));
    float thread1 =
      sin((threadPhase * 5.2 + wq.x * 2.6 + wq.y * 1.2) * 6.28318);
    float thread2 =
      sin((threadPhase * 4.0 + wq.x * 1.5 - wq.y * 2.6) * 6.28318);
    float thread3 =
      sin((threadPhase * 3.4 + wq.x * 0.9 + wq.y * 3.0) * 6.28318);
    float threadMask =
      (1.0 - smoothstep(0.004, 0.018, abs(thread1))) * 0.90 +
      (1.0 - smoothstep(0.004, 0.020, abs(thread2))) * 0.75 +
      (1.0 - smoothstep(0.004, 0.022, abs(thread3))) * 0.55;

    // Threads weak in dead-center, stronger toward edges and inside
    // smoke clouds.
    float threadGate = mix(0.45, 1.0, smoothstep(0.0, 0.50, smokeMask));
    threadGate *= centerClear;
    color = mix(color, COPPER, threadMask * threadGate * 0.30);

    // Tiny ink-dust grains in the smoke.
    vec2 spCellSize = vec2(1.0 / 90.0);
    vec2 spCell = floor(uv / spCellSize);
    vec2 spLocal = fract(uv / spCellSize) - 0.5;
    float spHash =
      fract(sin(dot(spCell, vec2(91.345, 47.853))) * 21459.1234);
    float spOn = step(0.991, spHash);
    float spDist = length(spLocal);
    float spDot = 1.0 - smoothstep(0.10, 0.25, spDist);
    float speckle = spOn * spDot;
    color = mix(color, INK, speckle * smokeMask * 0.55);

    // Whisper of paper fibers globally — keeps the cream alive without
    // adding visible structure.
    float fiber = sin(wq.x * 60.0 + wq.y * 18.0 + nLow * 2.0);
    float fiberMask = 1.0 - smoothstep(0.02, 0.18, abs(fiber));
    color = mix(color, INK, fiberMask * 0.012);

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

function MicrosoftMark() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-[2px]">
      <span className="h-3 w-3 bg-[#F25022]" />
      <span className="h-3 w-3 bg-[#7FBA00]" />
      <span className="h-3 w-3 bg-[#00A4EF]" />
      <span className="h-3 w-3 bg-[#FFB900]" />
    </span>
  );
}

function SumiSignIn() {
  const { loading, signIn } = useMicrosoftSignIn();

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        "group relative inline-flex min-h-[58px] items-center gap-5 overflow-hidden rounded-md px-7 py-4",
        "bg-[var(--ink)] text-[var(--paper)]",
        "shadow-[0_18px_45px_-26px_rgba(11,15,18,0.55)]",
        "transition-[transform,box-shadow] duration-500",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        "after:absolute after:inset-y-0 after:right-0 after:w-1.5 after:bg-[var(--acid)]",
        "hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-30px_rgba(11,15,18,0.65)]",
        "active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      <MicrosoftMark />
      <span className="font-display text-[15px] font-medium tracking-tight">
        {loading ? "Signing in" : "Sign in with Microsoft"}
      </span>
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--paper)] border-t-transparent" />
      )}
    </button>
  );
}

/**
 * Rendition 03 — Sumi-e Drift.
 * Charcoal smoke billows in opposite corners with curling copper
 * brushstrokes weaving through. Outline brand pill, rectangular CTA
 * with right-edge acid accent strip, footer signature low-right in
 * title case.
 */
export function SumiInkVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <section className="relative z-20 flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-28 pb-32 text-center sm:pt-32">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--ink)] bg-[var(--paper)]/72 px-4 py-2 backdrop-blur-sm">
          <Image
            src="/logos/cs-soc-official.svg"
            alt=""
            width={20}
            height={20}
            priority
            className="h-[20px] w-[20px]"
            aria-hidden
          />
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-[var(--ink)]">
            USM CSS AGM
          </span>
        </div>

        <h1 className="font-serif mt-10 text-[clamp(2.85rem,8vw,7rem)] font-medium leading-[0.96] tracking-[-0.005em] text-[var(--ink)]">
          Elect the next
          <br />
          CSS committee.
        </h1>

        <div className="mt-12">
          <SumiSignIn />
        </div>
      </section>

      <p className="absolute bottom-6 right-8 z-20 font-mono text-[11px] tracking-[0.08em] text-[var(--ink-muted)]">
        USM Computer Science Society{" "}
        <span className="text-[var(--copper)]">/</span>
      </p>
    </main>
  );
}
