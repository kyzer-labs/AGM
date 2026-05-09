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
}

const RENDITIONS: Rendition[] = [
  {
    slug: "aurora",
    index: "01",
    name: "Aurora Drift",
    vibe: "Editorial premium",
    description:
      "Domain-warped acid / teal / copper aurora with low-frequency ink isobars. Left-aligned hero, brand pill top center.",
    technique: "OGL · Domain Warp",
    accent: "acid",
  },
  {
    slug: "ribbons",
    index: "02",
    name: "Liquid Ribbons",
    vibe: "Modern · kinetic",
    description:
      "Four horizontal silk bands fluttering across the canvas, displaced by stacked simplex noise. Centered display type with an italic teal turn.",
    technique: "OGL · Sine + Noise",
    accent: "teal",
  },
  {
    slug: "plexus",
    index: "03",
    name: "Particle Plexus",
    vibe: "Civic · networked",
    description:
      "70 ink nodes drift on a 2D canvas; pairs within range connect with teal threads. Cursor gently repels nearby nodes — the network breathes when you move.",
    technique: "Canvas 2D · 70 nodes",
    accent: "ink",
  },
  {
    slug: "halftone",
    index: "04",
    name: "Halftone Pulse",
    vibe: "Newsprint · tactile",
    description:
      "A 56-wide grid of dots whose radius is driven by a flowing noise field plus a diagonal traveling wave. Editorial split layout — content lives along the left rail.",
    technique: "OGL · Halftone",
    accent: "copper",
  },
  {
    slug: "beams",
    index: "05",
    name: "Compass Beams",
    vibe: "Ceremonial · focused",
    description:
      "Counter-rotating radial beams + concentric rings around a copper core. Tightly centered ceremonial composition with the AGM phase pipeline beneath the CTA.",
    technique: "OGL · Polar Rays",
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
          design exploration · 5 of 5
        </span>
        <h1 className="font-display mt-6 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.96] tracking-[-0.04em] text-[var(--ink)]">
          Five directions
          <br />
          for the same door.
        </h1>
        <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Five complete landing renditions for the AGM portal &mdash; each
          with its own layout, copy, and WebGL animation. Open them in turn
          and pick the one that should become <code className="font-mono text-[0.95em] text-[var(--ink)]">/</code>.
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
