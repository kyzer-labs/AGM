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
    slug: "drift-mist",
    index: "02",
    name: "Drift Mist",
    vibe: "Ambient · breathing",
    description:
      "A single domain-warped low-frequency noise field maps to barely-there warm/cool tints over paper. No isobars, no shapes — just a quiet atmosphere that drifts behind the page.",
    technique: "OGL · noise wash",
    accent: "teal",
  },
  {
    slug: "soft-bokeh",
    index: "03",
    name: "Soft Bokeh",
    vibe: "Cinematic · out-of-focus",
    description:
      "Five large blurred orbs drift in lazy circles, each tinted with a different palette accent. Wide squared-smoothstep falloff so there are no visible edges or hot centers.",
    technique: "OGL · drifting orbs",
    accent: "acid",
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
    slug: "iridescent",
    index: "05",
    name: "Iridescent Sheen",
    vibe: "Subtle · shifting",
    description:
      "Three palette tints (teal · copper · acid) cross-fade through a slow noise field — like oil on water or the inside of a shell. The page quietly catches a different light each time you load it.",
    technique: "OGL · hue cross-fade",
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
          design exploration · round 02 · 5 of 5
        </span>
        <h1 className="font-display mt-6 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.96] tracking-[-0.04em] text-[var(--ink)]">
          Quieter backgrounds.
          <br />
          Same door.
        </h1>
        <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Particle Plexus is the keeper from round one. Four new variants
          treat the WebGL layer as scenery rather than spectacle &mdash;
          smooth, peripheral, never competing with the headline. Open each
          and pick the one to graft onto <code className="font-mono text-[0.95em] text-[var(--ink)]">/</code>.
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
