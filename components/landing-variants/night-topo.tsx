"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
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

  // Night Topography — dark navy-teal substrate with multi-level cyan
  // contour lines on a slow domain-warped noise field. A sparse hash
  // grid plants particle dots that only fire when the local noise is
  // close to a per-cell target isobar, so they look like points
  // travelling along the contours. Sparse copper accent contours appear
  // in the upper noise band, and a faint orthogonal grid floats over
  // everything for the technical-dashboard read.
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.06;

    const vec3 NIGHT_BG  = vec3(0.030, 0.075, 0.082);
    const vec3 NIGHT_BG2 = vec3(0.018, 0.052, 0.058);
    const vec3 CYAN      = vec3(0.32,  0.85,  0.85);
    const vec3 ACID_GLOW = vec3(0.83,  0.97,  0.36);

    // Slow vignette so the right side reads slightly brighter (where the
    // hot contour cluster sits in the reference image).
    vec2 c = (uv - vec2(0.6, 0.45)) * vec2(aspect, 1.0);
    float vignette = 1.0 - smoothstep(0.10, 0.95, length(c));

    // Domain warp.
    vec2 w1 = vec2(
      fbm(q * 0.55 + vec2(t)),
      fbm(q * 0.55 + vec2(5.2, t))
    );
    vec2 wq = q + w1 * 0.55;
    float n = fbm(wq * 0.55 + vec2(t * 0.4, t * 0.3));

    vec3 color = mix(NIGHT_BG2, NIGHT_BG, vignette);

    // Primary fine cyan contours (denser, lower opacity).
    float c1 = abs(fract(n * 8.0 + 0.5) - 0.5);
    float c1Mask = 1.0 - smoothstep(0.005, 0.018, c1);
    color = mix(color, CYAN, c1Mask * 0.22);

    // Secondary major contours (sparser, brighter).
    float c2 = abs(fract(n * 4.0 + 0.5) - 0.5);
    float c2Mask = 1.0 - smoothstep(0.003, 0.010, c2);
    color = mix(color, CYAN, c2Mask * 0.40);

    // Sparse copper accent contours, gated to a narrow noise band so
    // they only show up in a couple of slow drifting regions.
    float c3 = abs(fract(n * 5.0 + 0.18) - 0.5);
    float c3Mask = 1.0 - smoothstep(0.003, 0.012, c3);
    float copperGate = smoothstep(0.10, 0.25, n) *
                       (1.0 - smoothstep(0.45, 0.65, n));
    color = mix(color, COPPER, c3Mask * copperGate * 0.55);

    // Particle field: per-cell hash decides each cell's target contour
    // level. Particle fires only when the local noise is close to that
    // target — so dots populate the visible contours. Each particle
    // pulses on its own phase.
    vec2 cellSize = vec2(1.0 / 26.0);
    vec2 cell = floor(uv / cellSize);
    vec2 local = fract(uv / cellSize) - 0.5;
    float h1 =
      fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float h2 =
      fract(sin(dot(cell, vec2(34.213, 91.732))) * 12873.5417);

    float targetN = -0.45 + h1 * 0.90;
    float onLine = 1.0 - smoothstep(0.02, 0.08, abs(n - targetN));
    float dist = length(local);
    float pDot = 1.0 - smoothstep(0.04, 0.14, dist);
    float pulse = 0.45 + 0.55 * sin(uTime * 1.2 + h2 * 60.0);

    // Two flavors of particles — most are cyan, ~25% are acid for pop.
    float particle = pDot * onLine * step(0.55, h1) * pulse;
    float isAcid = step(0.75, h2);
    color += mix(CYAN, ACID_GLOW, isAcid) * particle * 0.85;

    // Faint orthogonal grid overlay.
    vec2 g = q * 22.0;
    vec2 gFract = abs(fract(g) - 0.5);
    float gridLine = step(0.49, max(gFract.x, gFract.y));
    color += vec3(0.10, 0.18, 0.20) * gridLine * 0.10;

    // Soft inner glow on the high-noise side to mimic the bright
    // contour cluster in the reference.
    float glow = smoothstep(0.3, 0.95, n) * vignette;
    color += CYAN * glow * 0.05;

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
 * Outlined dark-mode sign-in button styled to match the reference:
 * teal hairline border, paper text, MS color square as the icon. Reuses
 * the shared Microsoft sign-in hook so the auth flow stays identical to
 * the rest of the app.
 */
function NightSignIn() {
  const { loading, signIn } = useMicrosoftSignIn();
  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        "group relative inline-flex items-center gap-3 rounded-full px-5 py-3",
        "border border-[var(--teal)]/55 bg-[#0c2024]/40 text-[var(--paper)]",
        "transition-[background-color,border-color,transform] duration-500",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        "hover:border-[var(--teal)] hover:bg-[#0c2024]/65",
        "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#08191a]",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      <span aria-hidden className="grid grid-cols-2 gap-[2px]">
        <span className="h-2.5 w-2.5 bg-[#F25022]" />
        <span className="h-2.5 w-2.5 bg-[#7FBA00]" />
        <span className="h-2.5 w-2.5 bg-[#00A4EF]" />
        <span className="h-2.5 w-2.5 bg-[#FFB900]" />
      </span>
      <span aria-hidden className="h-5 w-px bg-[var(--paper)]/20" />
      <span className="font-display text-sm tracking-tight">
        {loading ? "Signing in" : "Sign in with Microsoft"}
      </span>
      {loading ? (
        <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--paper)] border-t-transparent" />
      ) : (
        <ArrowUpRight
          className="h-4 w-4 text-[var(--paper)]/60 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:text-[var(--paper)]"
          strokeWidth={2.25}
        />
      )}
    </button>
  );
}

/**
 * Rendition 05 — Night Topography.
 * Dark navy-teal substrate with cyan topographic contours, sparse
 * copper accent traces, glowing particle dots that travel along the
 * contour lines, and a faint orthogonal grid overlay. Asymmetric
 * editorial layout: top-left brand stack, bottom-left content with the
 * "Annual General Meeting" tag and an outlined dark-mode sign-in.
 */
export function NightTopoVariant() {
  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[#08191a] text-[var(--paper)]"
      style={{ colorScheme: "dark" }}
    >
      <OglCanvas fragment={FRAGMENT} />

      <header className="absolute left-8 top-8 z-20 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--teal)]/55 bg-[#0c2024]/55">
          <Image
            src="/logos/cs-soc-official.svg"
            alt=""
            width={26}
            height={26}
            priority
            className="h-[26px] w-[26px]"
            aria-hidden
          />
        </div>
        <div className="flex flex-col">
          <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--paper)]">
            USM CSS AGM
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/55">
            USM Computer Science Society
          </span>
        </div>
      </header>

      <section className="container-wide relative z-20 flex min-h-[100dvh] flex-col justify-end pb-28">
        <div className="flex max-w-3xl flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[var(--copper)]">⌐</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--copper)]">
              Annual General Meeting
            </span>
            <span className="h-px flex-1 max-w-[180px] bg-gradient-to-r from-[var(--copper)]/60 via-[var(--paper)]/30 to-transparent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/40">
              {new Date().getFullYear()}
            </span>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,7.5vw,6.5rem)] leading-[0.96] tracking-[-0.045em] text-[var(--paper)]">
            Elect the next
            <br />
            CSS committee.
          </h1>

          <div className="mt-2">
            <NightSignIn />
          </div>
        </div>
      </section>

      <p className="absolute bottom-3 right-6 z-20 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/45">
        rendition · 05 / night topography
      </p>
    </main>
  );
}
