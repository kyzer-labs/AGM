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

  // Marbled Veins — sage-teal sheets drape from the left and right edges,
  // organically narrow toward the center vertical (so the headline area
  // stays clear cream), and carry visible parallel marble bands inside.
  // Sparse copper hairlines trace the boundary, two layers of golden
  // sparkles drift through the teal, and a warm acid glow sits under
  // the centered CTA.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.040;

    vec2 w1 = vec2(
      fbm(q * 0.55 + vec2(t, 0.0)),
      fbm(q * 0.55 + vec2(5.2, t))
    );
    vec2 w2 = vec2(
      fbm(q * 1.15 + 1.6 * w1),
      fbm(q * 1.15 + 1.6 * w1 + vec2(2.3))
    );
    vec2 wq = q + w2 * 0.45;

    float nLow = fbm(wq * 0.55 + vec2(t * 0.30, t * 0.15));

    // Curving boundaries for the left and right teal sheets. The boundary
    // X position breathes with vertical position, fbm warp, and a slow sin
    // for organic curves that read as draped marble, not random noise.
    float leftWave =
      sin(uv.y * 5.4 + nLow * 2.8 + t * 0.7) * 0.08 +
      fbm(wq * 1.20 + vec2(0.0, t * 0.4)) * 0.18;
    float rightWave =
      -sin(uv.y * 5.0 + nLow * 2.6 + t * 0.65 + 1.7) * 0.08 +
      fbm(wq * 1.20 + vec2(11.3, t * 0.4)) * 0.18;

    float leftEdge  = 0.32 + leftWave;
    float rightEdge = 0.68 + rightWave;

    float leftMask  = smoothstep(leftEdge,  leftEdge  - 0.32, uv.x);
    float rightMask = smoothstep(rightEdge, rightEdge + 0.32, uv.x);
    float tealMask = clamp(leftMask + rightMask, 0.0, 1.0);

    // Internal marble bands — directional parallel veining inside the
    // teal sheets, modulated by warped noise so they curve gracefully.
    float bandPhase = wq.y * 5.5 + wq.x * 0.8 + nLow * 3.6;
    float bandSweep = sin(bandPhase);
    float bandLight = 0.5 + 0.5 * smoothstep(-0.40, 0.60, bandSweep);

    float fineBand = sin(bandPhase * 3.2 + nLow * 2.0);
    float fineBandLight = 0.5 + 0.5 * smoothstep(-0.20, 0.40, fineBand);

    vec3 paper = PAPER;
    vec3 paperWarm = mix(
      paper,
      vec3(0.96, 0.93, 0.86),
      smoothstep(0.30, 0.0, distance(uv, vec2(0.5, 0.45))) * 0.20
    );

    vec3 tealLight  = vec3(0.80, 0.88, 0.84);
    vec3 tealMidT   = vec3(0.55, 0.74, 0.72);
    vec3 tealDeep   = vec3(0.34, 0.56, 0.55);
    vec3 tealBlend  = mix(tealDeep, tealMidT, bandLight);
    tealBlend       = mix(tealBlend, tealLight, fineBandLight * 0.55);

    vec3 color = paperWarm;
    color = mix(color, tealBlend, tealMask * 0.78);

    // Fine ink fibers in the teal — paper-grain feeling.
    float fiber = sin(wq.x * 56.0 + wq.y * 22.0 + nLow * 3.0);
    float fiberMask = 1.0 - smoothstep(0.02, 0.16, abs(fiber));
    color = mix(color, INK, fiberMask * tealMask * 0.028);

    // Copper hairlines on the teal/paper boundary only — gives the soft
    // metallic seam visible in the reference.
    float boundaryRing =
      smoothstep(0.08, 0.42, tealMask) - smoothstep(0.55, 0.95, tealMask);
    float copperFlow =
      sin((wq.x * 3.2 - wq.y * 4.0 + nLow * 1.6 + t * 0.6) * 6.28318);
    float copperHair = 1.0 - smoothstep(0.004, 0.022, abs(copperFlow));
    color = mix(color, COPPER, copperHair * boundaryRing * 0.34);

    // Coarse twinkles — bigger soft dots that pulse slowly.
    vec2 sp1Cell = floor(uv * 30.0);
    vec2 sp1Local = fract(uv * 30.0) - 0.5;
    float sp1Hash =
      fract(sin(dot(sp1Cell, vec2(12.9898, 78.233))) * 43758.5453);
    float sp1On = step(0.940, sp1Hash);
    float sp1Dist = length(sp1Local);
    float sp1Dot = 1.0 - smoothstep(0.10, 0.32, sp1Dist);
    float sp1Pulse = 0.40 + 0.60 * sin(uTime * 1.4 + sp1Hash * 60.0);
    float spark = sp1On * sp1Dot * sp1Pulse * tealMask;
    color = mix(color, ACID, spark * 0.55);

    // Fine pinpoints — denser, brighter, no pulse, used as stardust.
    vec2 sp2Cell = floor(uv * 62.0);
    vec2 sp2Local = fract(uv * 62.0) - 0.5;
    float sp2Hash =
      fract(sin(dot(sp2Cell, vec2(45.789, 23.567))) * 19.9876);
    float sp2On = step(0.972, sp2Hash);
    float sp2Dist = length(sp2Local);
    float sp2Dot = 1.0 - smoothstep(0.05, 0.16, sp2Dist);
    float pinpoint = sp2On * sp2Dot * tealMask;
    color = mix(color, ACID, pinpoint * 0.80);

    // Acid glow under the CTA — soft warm bloom centered just below the
    // page midline.
    float glow = 1.0 - smoothstep(0.04, 0.30, distance(uv, vec2(0.50, 0.40)));
    color = mix(color, ACID, glow * 0.10);

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

function MarbledSignIn() {
  const { loading, signIn } = useMicrosoftSignIn();

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-[40px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,228,105,0.85), rgba(255,228,105,0.0) 75%)",
          transform: "scale(1.45)",
        }}
      />
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        aria-busy={loading || undefined}
        className={cn(
          "group inline-flex min-h-[60px] items-center gap-4 rounded-full px-9 py-4",
          "bg-[var(--ink)] text-[var(--paper)]",
          "shadow-[0_0_0_1px_rgba(11,15,18,0.10),0_30px_70px_-22px_rgba(255,228,105,0.95)]",
          "transition-[transform,box-shadow] duration-700",
          "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          "hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(11,15,18,0.10),0_36px_84px_-24px_rgba(255,228,105,1)]",
          "active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
          "disabled:cursor-not-allowed disabled:opacity-70",
        )}
      >
        <MicrosoftMark />
        <span className="font-display text-[15px] font-medium tracking-tight sm:text-base">
          {loading ? "Signing in" : "Sign in with Microsoft"}
        </span>
        {loading && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--paper)] border-t-transparent" />
        )}
      </button>
    </div>
  );
}

/**
 * Rendition 02 — Marbled Veins.
 * Cream paper with sage-teal currents hugging the side edges. Internal
 * marble veining, sparse copper hairlines on the boundary, abundant
 * golden sparkles, and a warm acid glow under the centered CTA.
 */
export function MarbledVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <OglCanvas fragment={FRAGMENT} />
      <GrainOverlay />

      <section className="relative z-20 flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-28 pb-32 text-center sm:pt-32">
        <div className="surface-glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 shadow-[0_14px_36px_-22px_rgba(11,15,18,0.40)]">
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

        <h1 className="font-serif mt-10 text-[clamp(3.25rem,9.5vw,8.5rem)] font-medium leading-[0.92] tracking-[-0.005em] text-[var(--ink)]">
          Elect the next
          <br />
          CSS committee.
        </h1>

        <div className="mt-12">
          <MarbledSignIn />
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-8 z-20 flex justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
      </footer>
    </main>
  );
}
