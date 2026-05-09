import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface Rendition {
  slug: string;
  index: string;
  name: string;
  vibe: string;
  description: string;
  technique: string;
  accent: "acid" | "teal" | "copper" | "ink";
  keeper?: boolean;
}

const RENDITIONS: Rendition[] = [
  {
    slug: "plexus",
    index: "01",
    name: "Particle Plexus",
    vibe: "Civic · networked",
    description:
      "70 ink nodes drift on a 2D canvas; pairs within range connect with teal threads. Cursor gently repels nearby nodes — the network breathes when you move.",
    technique: "Canvas 2D · 70 nodes",
    accent: "ink",
    keeper: true,
  },
  {
    slug: "marbled",
    index: "02",
    name: "Marbled Veins",
    vibe: "Watercolor · flowing",
    description:
      "Edge-weighted teal swathes pour in from the rim like watercolor on wet paper. Fine copper hairlines vein the noise isobars and sparse acid sparkles drift through. The headline area in the centre stays clean paper.",
    technique: "OGL · marbled flow",
    accent: "teal",
  },
  {
    slug: "sumi-ink",
    index: "03",
    name: "Sumi-e Drift",
    vibe: "Editorial · ink wash",
    description:
      "Soft graphite ink shapes drift in from the corners with brush-hair line texture flowing inside them. Copper accent traces hold the boundary; sparse ink speckle plays at the edges. Negative space frames the headline.",
    technique: "OGL · brushed ink",
    accent: "ink",
  },
  {
    slug: "whisper-lines",
    index: "04",
    name: "Whisper Lines",
    vibe: "Architectural · trace",
    description:
      "Domain-warped sine waves drawn in the faintest possible ink, layered over a near-imperceptible teal wash. Reads as a hint of motion, never as a graphic statement.",
    technique: "OGL · curved hatch",
    accent: "ink",
  },
  {
    slug: "night-topo",
    index: "05",
    name: "Night Topography",
    vibe: "Technical · dark",
    description:
      "Dark navy-teal substrate. Cyan topographic contours sweep across the field, sparse copper accent traces drift through, and glowing particle dots travel along the contour lines. Faint orthogonal grid keeps it dashboard-true.",
    technique: "OGL · dark contours",
    accent: "copper",
  },
];

const ACCENT_BG: Record<Rendition["accent"], string> = {
  acid: "bg-[var(--acid)]",
  teal: "bg-[var(--teal)]",
  copper: "bg-[var(--copper)]",
  ink: "bg-[var(--ink)]",
};

const ACCENT_TEXT: Record<Rendition["accent"], string> = {
  acid: "text-[var(--ink)]",
  teal: "text-[var(--paper)]",
  copper: "text-[var(--paper)]",
  ink: "text-[var(--paper)]",
};

export default function RenditionPickerPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <header className="container-wide flex items-center justify-between py-6">
        <div className="surface-glass flex items-center gap-2.5 rounded-full px-4 py-2">
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
            USM CSS AGM · rendition picker
          </span>
        </div>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
        >
          skip → dashboard
        </Link>
      </header>

      <section className="container-narrow pt-12 pb-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ink-muted)]">
          design exploration · round 03 · 5 of 5
        </span>
        <h1 className="font-display mt-6 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.96] tracking-[-0.04em] text-[var(--ink)]">
          Reference-led.
          <br />
          Three new takes.
        </h1>
        <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Particle Plexus and Whisper Lines stay. Three slots have been
          rebuilt against the new reference renders &mdash; marbled
          watercolor, sumi-e ink wash, and a dark technical topography.
          Open each and pick the one to graft onto <code className="font-mono text-[0.95em] text-[var(--ink)]">/</code>.
        </p>
      </section>

      <section className="container-narrow pb-24">
        <ul className="flex flex-col gap-4">
          {RENDITIONS.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/preview/${r.slug}`}
                className="group relative block overflow-hidden rounded-2xl border border-[var(--ink-line)] bg-[var(--paper)]/85 transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-[var(--ink)]/40 hover:shadow-[0_28px_60px_-30px_rgba(11,15,18,0.45)]"
              >
                <div
                  aria-hidden
                  className={`absolute left-0 top-0 h-full w-1.5 ${ACCENT_BG[r.accent]} transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] group-hover:w-2`}
                />

                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-7 py-7 pl-10 sm:gap-10 sm:px-10 sm:pl-14">
                  <div className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-[3.5rem]">
                    {r.index}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                      <h2 className="font-display text-[clamp(1.35rem,2.4vw,2rem)] leading-tight tracking-[-0.025em] text-[var(--ink)]">
                        {r.name}
                      </h2>
                      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
                        {r.vibe}
                      </span>
                      {r.keeper && (
                        <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--paper)]">
                          keeper
                        </span>
                      )}
                    </div>
                    <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-[var(--ink-muted)]">
                      {r.description}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--ink-line)] bg-[var(--paper-2)]/60 px-3 py-1">
                      <span
                        aria-hidden
                        className={`inline-block h-1.5 w-1.5 rounded-full ${ACCENT_BG[r.accent]}`}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink)]">
                        {r.technique}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full ${ACCENT_BG[r.accent]} ${ACCENT_TEXT[r.accent]} transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5`}
                  >
                    <ArrowUpRight className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="container-wide flex items-center justify-between pb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          internal · design preview only
        </p>
      </footer>
    </main>
  );
}
