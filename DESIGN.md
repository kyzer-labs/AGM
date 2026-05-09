# Design

> **Status: principles only, direction locked.** The visual direction has been chosen — Sumi-e Drift composition — and the locked landing ships at `app/page.tsx`. The Sumi-e backdrop is rendered as a static asset at `public/landing/sumi-backdrop.png` via `components/landing/landing-backdrop.tsx` (the original live-shader implementation was superseded; rationale captured in the brief's "Decision update"). The exploratory variant tree under `app/preview/*` has been removed. The exact token values (palette OKLCH, shadow scale, motion durations) are still **not** locked in this file; the working defaults live in `app/globals.css`. Re-run `/impeccable document` to propagate those into a fully-locked visual system. See `docs/landing-rendition-brief.md` for the rationale and the token propagation list.

## Surface taxonomy

The portal has two classes of surface, and every rule below scales by class:

- **Loud surfaces** — the unauthenticated landing, dormant waiting screens, the public published-results page. Decorative motion, ambient OGL backdrops, and expressive typography are *permitted* here, in service of the ceremonial-civic emotional outcome.
- **Quiet surfaces** — every authed working surface: profile completion, the live ballot, the rubric form, every admin mutation, the audit log, exports. Decorative motion is *banned*. Backgrounds stay calm and recessive. Typography is structural, not expressive.

**Default to quiet.** Justify every loud move against the question *"would a careful editor leave this in?"*

## Colour rules

- **Use OKLCH** for every colour you introduce. No raw HSL/RGB picked from a screenshot.
- **Reduce chroma at lightness extremes.** Acid yellows and copper accents look garish at L > 0.95; deep tones get muddy below L < 0.10. Stay within the OKLCH interior.
- **Never `#000` or `#fff`.** Tint every neutral toward the brand hue with chroma 0.005–0.012. Pure black-on-pure-white belongs to print, not screens.
- **Strategy: Restrained.** Tinted-paper background, ink foreground, ≤1 accent role active at a time on any quiet surface. **Loud surfaces may run Committed** (one saturated colour carrying 30–60% of the surface, e.g. the rendition variants), but every quiet surface stays Restrained.
- **One focus colour for the whole portal.** The current `--color-ring` (an OKLCH teal around `oklch(0.55 0.07 195)`) is acting as that token. Do not introduce a second focus colour just because a surface uses a different accent.
- **Status is never communicated by colour alone.** Active / completed / pending / error / success states must carry an icon, a text label, *and* a shape difference in addition to colour. WCAG 2.2 AA contrast (≥4.5:1 body, ≥3:1 large text and UI components) is a floor, not a target.
- **Selection / highlight follows the brand.** The current `::selection` uses `rgba(255, 228, 105, 0.75)` (the acid yellow at 75% over ink). Whatever rendition wins, the selection colour is a brand decision, not a default.

## Typography rules

The current type stack assigns roles, not final choices. Treat the families as provisional, treat the roles as canon:

| Role | Current pick | Use for |
| --- | --- | --- |
| Display (H1–H4) | Unbounded | Page titles, section heads, rendition numerals, the published-results headline |
| Body / sans / mono | Azeret Mono | Default body, metadata labels, code, technique tags, status strings |
| Serif | Playfair Display | Editorial moments, candidate biographies, ceremonial pull-quotes |

Rules that apply regardless of which families ultimately win:

- **Body line length capped at 65–75ch.** No edge-to-edge text columns even on wide admin tables.
- **Hierarchy through scale + weight contrast (≥1.25 step ratio).** Flat type ladders read as default-CMS.
- **Display tracking is negative** (-0.02em to -0.04em) on large sizes. Body and metadata stay at 0 or slightly positive.
- **Monospace as body is intentional, not provisional.** It is the audience signal for a CS-society portal. If it ever feels heavy on long-form admin reads, reach for the *serif* role first, not for a generic sans.
- **Uppercase tracking is reserved for metadata** — status labels, technique tags, section markers, breadcrumb crumbs. Tracking range `0.20em–0.32em`. **Never uppercase headlines.**
- **Numerals use tabular figures wherever they line up** — vote counts, percentages, results tables, rubric scores. Avoid proportional figures in any column where users will visually compare numbers.

## Layout & scaffolding rules

- **Honest scaffolding shows.** The 28 px grid overlay (currently `body::before` in `app/globals.css`), numbered section markers (`01`, `02`, …), labelled metadata strips, and uppercase technique tags are *the structure of the document*. They earn their keep on every loud surface and on at least one structural element of every quiet surface (e.g. the breadcrumb on admin pages, the rubric category headers on the evaluator page).
- **Containers**:
  - `container-narrow` (max 56 rem) for forms, ballots, profile flows, single-column reads.
  - `container-wide` (max 80 rem) for admin tables, dashboards, results.
  - Don't wrap everything; full-bleed is fine for shaders, hero strips, the grid overlay.
- **Cards are the lazy answer.** Use them only when they are actually the best affordance (candidate cards on a ballot, a candidate's photo + name + matric block). **Nested cards are always wrong.**
- **Vary spacing for rhythm.** Same padding everywhere reads as monotony. Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px (every step has a job).

## Motion rules

- **One ease curve.** `cubic-bezier(0.32, 0.72, 0, 1)` (an ease-out-quart-ish curve) is the portal's signature. Use it for transforms, opacity, and any layout-state shift. Do not introduce a second curve unless you can name the role it is playing.
- **Durations**:
  - Micro-interactions (hover, focus, press): 150–250 ms
  - Card / tile transitions, surface fades: 400–700 ms
  - Ambient shader drift, standby pulses: 1.5–3 s
  - Anything > 1 s that is not ambient is suspect.
- **Don't animate CSS layout properties.** Transform and opacity only. No `width`, `height`, `top`, `left`, `padding`, `margin` transitions.
- **No bounce, no elastic, no spring overshoot** anywhere on this portal. Ease-out only.
- **`prefers-reduced-motion` is enforced everywhere.** Tile-enter, standby pulses, shader backdrops, focus transitions — all collapse to static or near-static under reduced motion. Already implemented for `tile-enter` and `standby-dot-ring` in `app/globals.css`; do the same for any new motion you add, in the same `@media (prefers-reduced-motion: reduce)` block.
- **The vote-moment lockdown.** While a ballot or rubric form is live and unsubmitted, no animated decoration may be on screen. Static backdrops only. This is a hard rule, not a guideline.

## Component rules (rather than locked component specs)

Until the rendition is picked, these are the *rules* every component must obey:

- **Buttons.** One primary action per surface; never two competing CTAs. Ink-on-paper for the principal action, outline / ghost for secondaries. Always render a `:focus-visible` ring (no relying on the browser default outline). The "Button-in-Button" pattern in `components/landing/sign-in-cta.tsx` is the reference for high-stakes loud-surface CTAs.
- **Inputs.** Labelled, never placeholder-as-label. Errors render under the field in plain English with a recovery hint, not as a colour tint alone.
- **Modals / dialogs.** Used for create + edit flows (per project preference). Never for confirmations of irreversible actions where the consequence isn't obvious — those dialogs must show *what will change* in plain text, not just "Are you sure?"
- **Toasts.** Routed through `sonner`. Never the native browser `alert` / `confirm` / `prompt`.
- **Tables.** Density is contextual: admin = compact; voter-facing = roomy. Sortable when sort matters; never sortable for visual decoration.
- **Status badges.** Text label + dot/icon + appropriate shape. Never colour alone. Live states (active vote, internal window open) must visibly differ from their inactive counterparts at a glance.
- **Empty states.** Always include a one-sentence explanation of what would normally appear here, and the next action that would cause it to appear. Never just a centered icon and "No data."

## Voice & UX copy rules

(See `PRODUCT.md` → Brand Personality → Voice for the full statement; the design-relevant excerpts:)

- **State the state, specifically.** *"Internal evaluation closed Friday 17 May, 23:59 MYT"* beats *"Voting is no longer available right now."*
- **Plain English for failures.** No raw stack traces, Convex `ConvexError` payloads, or Firebase exception text in the UI. Every error includes a recovery action and (when applicable) a contact.
- **No em dashes (`—`) in UI copy.** Use commas, colons, semicolons, periods, or parentheses. Also not the ASCII `--`. The en dash `–` is permitted *only* for numeric ranges (e.g. *"60–75% of the final result"*).
- **Tone**: never cute, never apologetic, never marketing-speak. If you wouldn't write it on a printed institutional notice, don't put it in the UI.

## Banned by default

Absolute design bans on this project. If you find yourself reaching for one, rewrite the element with different structure:

- **Side-stripe borders.** `border-left` or `border-right` greater than 1 px as a coloured accent on cards, list items, callouts, alerts. Never intentional. Use full borders, background tints, leading numbers/icons, or nothing. (Note: the rendition picker on `/` uses a 1.5 px–2 px coloured *bleed strip* on the left edge of each rendition card; this is the documented exception, used because the card *is* a paint sample. Do not extend this pattern to other surfaces.)
- **Gradient text** (`background-clip: text` + gradient background). Decorative, never meaningful. Use a solid colour and earn emphasis with weight or scale.
- **Glassmorphism as default surface.** The `surface-glass` utility exists for rare considered moments (the rendition-picker badge in `app/page.tsx`). It is not the default card treatment.
- **Hero-metric template** (big number + small label + supporting stats + gradient accent). SaaS cliché.
- **Identical card grids** (same-sized cards with icon + heading + text repeated endlessly).
- **Modal-as-first-thought** for state changes that could happen inline.
- **Default browser `alert` / `confirm` / `prompt`.** Always go through `sonner` or a custom dialog.
- **Visible colour-mixing seams in CSS gradients.** If a gradient shows banding or a hue shift mid-bezel, redo it with OKLCH stops or replace it with a solid surface. Per the project preference: backgrounds stay calm and recessive — they should not steal focus from content.
- **Animated decoration on a live ballot or rubric form.** Hard rule, repeated from Motion above because it is the most-violated one.

## What this file does not lock (and why)

Intentionally absent until `/impeccable document` runs:

- **Exact palette hex / OKLCH values** for `--paper`, `--ink`, `--teal`, `--acid`, `--copper`, etc. The current values in `app/globals.css` are the working defaults that the locked Sumi-e shader was tuned against; they are not yet canon and have not been audited for OKLCH correctness or for AA contrast on every pairing.
- **Component visual specs** (exact radii, shadows, hover treatments). The `components/ui/*` primitives currently encode reasonable defaults; they will be hardened into a documented system in the documentation pass.
- **Acid yellow's role across surfaces.** Locked role on the landing is "selection highlight only" (no CTA accent, no ambient bloom). Open: focus-state tinting, hover indication, sparing use as success/info accent on quiet surfaces.

The shader backdrop choice itself **is** locked: Sumi-e Drift, perf-hardened to the Whisper Lines budget, lives on the landing only. The dormant waiting state may receive a recessed variant when that surface is shaped — never behind a live ballot or a rubric form.

Final font families are also locked:

- **Display** — Unbounded (existing).
- **Body / Mono** — Azeret Mono (existing).
- **Serif** — Spectral (chosen during craft to replace the Playfair Display placeholder, which sits on the brand register's reflex-reject list; Spectral was commissioned for institutional long-form reading and matches the AGM portal's ceremonial-civic register).

To complete the visual system, the next workflow step is:

1. Re-run `/impeccable document` to scan the locked tokens, type stack, and component specs into a full DESIGN.md.
2. Update this file's status banner to remove "principles only".
