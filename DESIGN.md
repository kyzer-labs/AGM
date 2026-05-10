# Design

> **Status: tokens locked from `app/globals.css` and `components/ui/*` as of 10 May 2026 MYT.** The visual direction is locked (Sumi-e Drift on the landing, baked to a static asset at `public/landing/sumi-backdrop.png` via `components/landing/landing-backdrop.tsx`), the type stack is locked (Unbounded · Azeret Mono · Spectral), the paper-direct palette is locked, the motion curve and durations are locked, and every shared UI primitive shipped through the four-tier sweep is documented below. Re-run `/impeccable document` after the next major design cycle to refresh. See `docs/landing-rendition-brief.md` for the rationale behind the landing decision.

## Surface taxonomy

The portal has two classes of surface, and every rule below scales by class:

- **Loud surfaces** — the unauthenticated landing, dormant waiting screens, the public published-results page. Decorative motion, ambient backdrops, and expressive typography are *permitted* here, in service of the ceremonial-civic emotional outcome.
- **Quiet surfaces** — every authed working surface: profile completion, the live ballot, the rubric form, every admin mutation, the audit log, exports. Decorative motion is *banned*. Backgrounds stay calm and recessive. Typography is structural, not expressive.

**Default to quiet.** Justify every loud move against the question *"would a careful editor leave this in?"*

## Colour rules

- **Use OKLCH** for every colour you introduce. No raw HSL/RGB picked from a screenshot.
- **Reduce chroma at lightness extremes.** Acid yellows and copper accents look garish at L > 0.95; deep tones get muddy below L < 0.10. Stay within the OKLCH interior.
- **Never `#000` or `#fff`.** Tint every neutral toward the brand hue with chroma 0.005–0.012. Pure black-on-pure-white belongs to print, not screens.
- **Strategy: Restrained.** Tinted-paper background, ink foreground, ≤1 accent role active at a time on any quiet surface. **Loud surfaces may run Committed** (one saturated colour carrying 30–60% of the surface, e.g. the landing hero), but every quiet surface stays Restrained.
- **One focus colour for the whole portal.** `--color-ring` (`oklch(0.55 0.07 195)`, a deep teal) is that token. Do not introduce a second focus colour just because a surface uses a different accent.
- **Status is never communicated by colour alone.** Active / completed / pending / error / success states must carry an icon, a text label, *and* a shape difference in addition to colour. WCAG 2.2 AA contrast (≥4.5:1 body, ≥3:1 large text and UI components) is a floor, not a target.
- **Selection / highlight follows the brand.** `::selection` uses `rgba(255, 228, 105, 0.75)` (the acid yellow at 75% over ink). The selection colour is a brand decision, not a default.

## Colour tokens

The portal runs **two parallel token systems** that coexist intentionally. The paper-direct primaries carry the editorial voice on every voter-facing and admin surface; the shadcn-dialect `--color-*` tokens carry the lower-level chrome that primitives like `<Card>`, `<Button>`, and `<Badge>` were originally built against. Dialect unification is a future audit candidate, not a closeout task.

### Paper-direct primaries

The locked working palette is a warm-paper-and-ink editorial register tuned for ceremonial civic gravity. Hex values are the literals in `app/globals.css`; OKLCH precision is approximated below from the documented intent and is itself a future audit candidate.

| Token | Hex | OKLCH (approx) | Role |
| --- | --- | --- | --- |
| `--paper` | `#f6f2ea` | warm cream, L ≈ 0.96, very low chroma at hue 80 | Body background; the canonical "paper" ground every quiet surface sits on. Also `--color-background` and `--color-primary-foreground`. |
| `--paper-2` | `#f2ede2` | slightly deeper cream, L ≈ 0.94 | Surface-on-paper tone. Used by `<NoticeStrip>`, the dashboard tier cards, the rubric save bar. Always reads as "still paper, but a layer up". |
| `--ink` | `#0b0f12` | near-black with cool tint, L ≈ 0.10, hue 220 | Body text, primary ink, principal CTA fill on the landing. Also `--color-foreground` and `--color-primary`. |
| `--ink-muted` | `rgba(11, 15, 18, 0.62)` | ink at 62% opacity, reads ≈ L 0.40 over paper | Secondary text, metadata labels, table column headers, every uppercase tracked label. |
| `--ink-line` | `rgba(11, 15, 18, 0.14)` | ink at 14% opacity | Borders, dividers, table row separators. The 1 px scaffolding line of the document. |
| `--copper` | `#bd8e34` | warm metallic, L ≈ 0.62, hue ≈ 75 | Committee / role accent, super-admin chip, allowlist highlight, the middle-dot separator inside every `<SectionMarker>`, the `<NoticeStrip>` border default. **Not a body-text colour.** |
| `--teal` | `#0f6a6a` | deep institutional teal, L ≈ 0.42, hue ≈ 195 | Brand identity (`--color-brand`). Used on brand chips and as the focus ring's hue family. Passes AA against paper. |
| `--acid` | `#ffe469` | bright warm yellow, L ≈ 0.92, hue ≈ 95 | Selection highlight (75% over ink). Mapped to `--color-warning` for warning chips. **Never a body-text colour against paper** — fails AA. |

Documented WCAG AA pairings (approximate, AAA where noted):

- `--ink` on `--paper` → AAA, the body-text default.
- `--ink` on `--paper-2` → AAA.
- `--ink-muted` on `--paper` → AA, the metadata default.
- `--teal` on `--paper` → AA, used on brand chip ink and link-button "link" variant text.
- `--paper` / `--color-brand-foreground` on `--teal` → AA, used on brand-tone `<Badge>`.
- `--paper` / `--color-accent-foreground` on `--copper` → AA for large text and UI components; verify per-pair before using copper as body-text foreground.
- `--ink` on `--acid` → AAA, used on warning chips and the `<SignInCTA>` capsule.
- **Pairings that fail AA and must not be used:** `--acid` on `--paper` (body text); `--copper` as text against `--paper-2` for sizes < 18 px (passes UI-element threshold, fails small-body threshold).

### Shadcn-dialect secondary system

The `--color-*` family in `app/globals.css` is the secondary token system used by lower-level chrome — the `<Card>`, `<Button>`, `<LinkButton>`, `<Badge>` default tones, table backgrounds, dialog grounds. Surfaces should still reach for the paper-direct primaries first; this system is here so the shadcn-derived primitives keep working without rewriting.

| Token | Value | Role |
| --- | --- | --- |
| `--color-background` | `#f6f2ea` | Aliases `--paper`. |
| `--color-foreground` | `#0b0f12` | Aliases `--ink`. |
| `--color-card` | `oklch(0.985 0.008 80)` | Card surface ground, slightly lighter than paper. |
| `--color-card-foreground` | `#0b0f12` | Card body ink. |
| `--color-muted` | `oklch(0.95 0.012 80)` | Muted button hover ground, skeleton ground. |
| `--color-muted-foreground` | `oklch(0.45 0.012 80)` | Muted prose foreground. The "secondary copy" tone shadcn primitives reach for. |
| `--color-border` | `oklch(0.85 0.012 80)` | Default 1 px border on form controls and cards. |
| `--color-input` | `oklch(0.88 0.012 80)` | Input chrome border. |
| `--color-ring` | `oklch(0.55 0.07 195)` | The single focus ring colour for the entire portal. Render every interactive element with `:focus-visible` ring 2 px solid this token at 2 px offset (`app/globals.css` line 114). |
| `--color-primary` | `#0b0f12` | Aliases `--ink`. Primary button fill. |
| `--color-primary-foreground` | `#f6f2ea` | Aliases `--paper`. Primary button text. |
| `--color-secondary` | `oklch(0.93 0.012 80)` | Neutral chip ground, secondary button fill. |
| `--color-secondary-foreground` | `#0b0f12` | Aliases `--ink`. |
| `--color-accent` | `#bd8e34` | Aliases `--copper`. Used on copper-tone `<Badge>`. |
| `--color-accent-foreground` | `#f6f2ea` | Aliases `--paper`. |
| `--color-destructive` | `oklch(0.58 0.19 28)` | Warm red. Destructive button, audit emergency, CSV row-error reason. |
| `--color-destructive-foreground` | `#f6f2ea` | Aliases `--paper`. |
| `--color-success` | `oklch(0.5 0.09 195)` | Deep teal. Submitted state, success badge, the green check on the vote receipt. |
| `--color-success-foreground` | `#f6f2ea` | Aliases `--paper`. |
| `--color-warning` | `#ffe469` | Aliases `--acid`. Warning chip ground. |
| `--color-warning-foreground` | `#0b0f12` | Aliases `--ink`. |
| `--color-brand` | `#0f6a6a` | Aliases `--teal`. Brand chip ground, link-variant button text. |
| `--color-brand-foreground` | `#f6f2ea` | Aliases `--paper`. |

Radius scale (`--radius-sm` `0.375rem` / `--radius-md` `0.625rem` / `--radius-lg` `0.875rem` / `--radius-xl` `1.125rem`) is fixed in `@theme`. Use the named scale, not literal pixel values, on any new surface.

## Typography rules

Roles and pairings are canon. Family choices are also locked (see *Type stack* below).

| Role | Family | Use for |
| --- | --- | --- |
| Display (H1–H4) | Unbounded | Page titles, section heads, the published-results headline, the cycle name on standby surfaces |
| Body / sans / mono | Azeret Mono | Default body, metadata labels, code, status strings, every tabular-num column |
| Serif | Spectral | Editorial moments, candidate biographies, ceremonial pull-quotes on the published-results surface |

Rules that apply to the entire stack:

- **Body line length capped at 65–75ch.** No edge-to-edge text columns even on wide admin tables.
- **Hierarchy through scale + weight contrast (≥1.25 step ratio).** Flat type ladders read as default-CMS.
- **Display tracking is negative** (`-0.02em` to `-0.04em`) on large sizes. Body and metadata stay at 0 or slightly positive.
- **Monospace as body is intentional, not provisional.** It is the audience signal for a CS-society portal. If it ever feels heavy on long-form admin reads, reach for the *serif* role first, not for a generic sans.
- **Uppercase tracking is reserved for metadata** — status labels, technique tags, section markers, breadcrumb crumbs. Tracking range `0.18em–0.32em`. **Never uppercase headlines.**
- **Numerals use tabular figures wherever they line up** — vote counts, percentages, results tables, rubric scores. Avoid proportional figures in any column where users will visually compare numbers.

## Type stack

The locked families ship via `next/font/google` from `app/layout.tsx` and are wired into `@theme` via the `--font-*` CSS variables in `app/globals.css`.

- **Display — Unbounded.** Loaded via `next/font/google` with subsets `latin`, weights `300 / 400 / 500 / 600 / 700`, exposed as the CSS variable `--font-unbounded` and the theme token `--font-display`. Role: every page H1, the section heads on `<NoticeStrip>` h2s, the published-results headline, the dashboard cycle title, the rubric save-bar count, the `<Standby>` cycle name. The `.font-display` utility class also applies `letter-spacing: -0.02em` automatically.
- **Mono — Azeret Mono.** Loaded with subsets `latin`, weights `300 / 400 / 500 / 600`, exposed as `--font-azeret-mono` and the theme tokens `--font-mono` and `--font-sans`. Role: default `<body>` font; every metadata label (`<SectionMarker>`, `<Meta>`, table column headers, breadcrumb segments); every status string and toast description; every `tabular-nums` numeric column.
- **Serif — Spectral.** Loaded with subsets `latin`, weights `400 / 500 / 600 / 700`, both `normal` and `italic` styles, exposed as `--font-spectral` and the theme token `--font-serif`. Role: ceremonial moments only — the landing headline, candidate biographies on the published-results surface, pull-quotes when the surface earns one. Spectral was chosen over Playfair Display (which sits on the brand register's reflex-reject list) because Spectral was commissioned for institutional long-form reading and matches the AGM portal's emotional outcome (ceremonial civic gravity). The selection rationale lives in `app/layout.tsx`.

**Reflex-reject list (DO NOT introduce):** Inter, Playfair Display, Cormorant, Fraunces, IBM Plex (any cut), DM Sans, DM Serif, Outfit, Space Grotesk, Plus Jakarta Sans, Instrument Sans, Instrument Serif. These are training-data defaults and they create monoculture. The full reflex-reject list is in `/home/kyzer/.agents/skills/impeccable/reference/brand.md`.

## Spacing canon

The locked spacing scale is **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px**. Every step has a job; do not invent an in-between step (no 18, no 28, no 40) without a reason that survives review.

- 4 / 8 px → tight token spacing, icon-to-label, dot separators.
- 12 / 16 px → input padding, card internal gutter, tile internal padding.
- 24 / 32 px → section gap, header-to-body separation, vertical rhythm between major elements.
- 48 / 64 / 96 px → page-level rhythm, hero spacing, the breathing room at the top and bottom of `container-narrow` / `container-wide` reads.

Containers are also fixed:

- `container-narrow` (`max-width: 56rem`, `padding-inline: 1.25rem`) for forms, ballots, profile flows, single-column reads.
- `container-wide` (`max-width: 80rem`, `padding-inline: 1.5rem`) for admin tables, dashboards, the published results surface.
- Don't wrap everything; full-bleed is fine for the landing backdrop, hero strips, and the body-grid overlay.

## Layout & scaffolding rules

- **Honest scaffolding shows.** The 28 × 28 px grid overlay (`body::before` in `app/globals.css`, opacity 0.18 with `mix-blend-mode: multiply`), numbered section markers (`01`, `02`, …), labelled metadata strips, and uppercase technique tags are *the structure of the document*. They earn their keep on every loud surface and on at least one structural element of every quiet surface (e.g. the breadcrumb on admin pages, the rubric category headers on the evaluator page).
- **Cards are the lazy answer.** Use them only when they are actually the best affordance (candidate cards on a ballot, a candidate's photo + name + matric block). **Nested cards are always wrong.**
- **Vary spacing for rhythm.** Same padding everywhere reads as monotony.

## Motion rules

- **One ease curve.** `cubic-bezier(0.32, 0.72, 0, 1)` (an ease-out-quart-ish curve) is the portal's signature. Use it for transforms, opacity, and any layout-state shift. Do not introduce a second curve unless you can name the role it is playing. Two named exceptions are documented in `app/globals.css`: the `standby-pulse` keyframe uses `cubic-bezier(0.4, 0, 0.6, 1)` for the symmetrical breathing of a status dot, and the landing's `breath-composite` keyframe uses `cubic-bezier(0.45, 0, 0.55, 1)` for the 26-second macro breath of the painted backdrop. Both are ambient-only and pre-existing; no new ambient surface should add a third.
- **Durations** (canon):
  - **Micro** (hover, focus, press): **150–250 ms**
  - **Surface** (card / tile transitions, surface fades): **400–700 ms**
  - **Ambient** (shader drift, standby pulse, landing breath): **1.5–3 s** (the landing breath is 26 s, the documented far edge of the ambient class)
  - Anything > 1 s that is not ambient is suspect.
- **Don't animate CSS layout properties.** Transform and opacity only. No `width`, `height`, `top`, `left`, `padding`, `margin` transitions.
- **No bounce, no elastic, no spring overshoot** anywhere on this portal. Ease-out only.
- **`prefers-reduced-motion` is enforced everywhere.** `tile-enter`, `standby-dot-ring`, and the landing `breath-composite` already collapse to static or near-static under reduced motion (see the `@media (prefers-reduced-motion: reduce)` and `@media (prefers-reduced-motion: no-preference)` blocks in `app/globals.css`). Do the same for any new motion you add, in those same blocks.
- **The vote-moment lockdown.** While a ballot or rubric form is live and unsubmitted, no animated decoration may be on screen. Static backdrops only. This is a hard rule, not a guideline.

## Component rules

Rules every component must obey, regardless of whether it has a shared primitive yet:

- **Buttons.** One primary action per surface; never two competing CTAs. Ink-on-paper for the principal action, outline / ghost for secondaries. Always render a `:focus-visible` ring (no relying on the browser default outline). The "Button-in-Button" pattern in `<SignInCTA>` is the reference for high-stakes loud-surface CTAs.
- **Inputs.** Labelled, never placeholder-as-label. Errors render under the field in plain English with a recovery hint, not as a colour tint alone.
- **Modals / dialogs.** Used for create + edit flows (per project preference). Never for confirmations of irreversible actions where the consequence isn't obvious — those dialogs must show *what will change* in plain text, not just "Are you sure?".
- **Toasts.** Routed through `sonner`. Never the native browser `alert` / `confirm` / `prompt`.
- **Tables.** Density is contextual: admin = compact; voter-facing = roomy. Sortable when sort matters; never sortable for visual decoration.
- **Status badges.** Text label + dot/icon + appropriate shape. Never colour alone. Live states (active vote, internal window open) must visibly differ from their inactive counterparts at a glance. The full role/class chip ladder is documented under *Status badge convention* below.
- **Empty states.** Always include a one-sentence explanation of what would normally appear here, and the next action that would cause it to appear. Never just a centered icon and "No data."

## Component primitives

Every shared primitive that survived the four-tier sweep is canon. The list below is the documented public API and the current consumer set; new admin or voter-facing surfaces should reach for these primitives first instead of inlining the same shape a sixth time.

### `<SectionMarker>` — `components/ui/section-marker.tsx`

Mono section-marker used as the leading metadata strip on every page header.

```ts
interface SectionMarkerProps {
  primary: ReactNode;          // first label, e.g. "Standby", "Live ballot"
  secondary?: ReactNode;       // second label, joined by a copper middle-dot
  className?: string;
}
```

Renders `Primary · Secondary` where the dot is in `--copper`, matching the landing's brand pill so the whole portal speaks one mark of identity. For three-part markers, compose the `secondary` slot with a nested copper middle-dot span so the second separator stays visually consistent with the first.

Consumers: `app/(authed)/vote/page.tsx`, `app/(authed)/internal/page.tsx`, `app/(authed)/results/page.tsx`, `app/(authed)/profile/complete/page.tsx`, `app/(authed)/admin/page.tsx`, `app/(authed)/admin/election/page.tsx`, `app/(authed)/admin/positions/page.tsx`, `app/(authed)/admin/candidates/page.tsx`, `app/(authed)/admin/whitelist/page.tsx`, `app/(authed)/admin/internal/page.tsx`, `app/(authed)/admin/public/page.tsx`, `app/(authed)/admin/results/page.tsx`, `app/(authed)/admin/exports/page.tsx`, `app/(authed)/admin/admins/page.tsx`, `app/(authed)/admin/dev/page.tsx`, plus `<Standby>` and `<NoticeStrip>` internally.

### `<Standby>` — `components/ui/standby.tsx`

Editorial waiting block used by every voter-facing page when its surface is awaiting a phase change.

```ts
interface StandbyProps {
  markerPrimary: ReactNode;        // SectionMarker primary, e.g. "Standby"
  markerSecondary?: ReactNode;     // SectionMarker secondary, e.g. phase label
  cycleName: string | null;        // editorial h1; null falls back to "No active AGM cycle"
  body: ReactNode;                 // explanatory paragraph
  children?: ReactNode;            // optional slot for MetaGroup, status footer, pulsing dot
  className?: string;
}
```

The container is itself a `<main>` so this is a top-level surface, not a nested fragment; pages must not wrap it in another `<main>`. Always supply a body that names *what* opens this surface and *when* — never "No data." The void state is its own kind of read.

Consumers: `app/(authed)/dashboard/page.tsx`, `app/(authed)/vote/page.tsx`, `app/(authed)/internal/page.tsx`, `app/(authed)/results/page.tsx`.

### `<Meta>` + `<MetaGroup>` — `components/ui/meta.tsx`

Label-over-value metadata pairs, semantically `<dl>` / `<dt>` / `<dd>`, for window timestamps, weight splits, configured durations, and any other "settled fact about this cycle" data row.

```ts
interface MetaProps {
  label: string;       // mono uppercase tracked label
  value: ReactNode;    // tabular-num value rendered under the label
}

interface MetaGroupProps {
  className?: string;  // append to the default `grid gap-6 border-t pt-6`
  children: ReactNode; // <Meta /> children
}
```

`<Meta>` must always render inside a `<MetaGroup>` (or any other `<dl>`-based container) so the surrounding semantics stay valid. `<MetaGroup>` defaults to a single-column top-bordered grid; consumers grow it to two or three columns by passing `sm:grid-cols-2` etc. via `className`.

### `<NoticeStrip>` — `components/ui/notice-strip.tsx`

The copper-bordered editorial notice the admin tree uses for first-time setup, phase-mismatch warnings, action gates, blocking-tie alerts, and the `<ImportSummaryStrip>` shell.

```ts
type Tone = "copper" | "destructive" | "neutral";

interface NoticeStripProps {
  markerPrimary: string;
  markerSecondary?: string;
  markerIcon?: ReactNode;       // e.g. AlertTriangle painted in copper or destructive
  headline: string;             // Display-family h2
  children: ReactNode;          // body + actions
  tone?: Tone;                  // border accent; defaults to "copper"
  role?: "alert";               // for blocking-action notices
  className?: string;
}
```

Renders a `border-y` section in the chosen tone over a `--paper-2` ground, with a `<SectionMarker>` + display-family h2 header group at the top and `aria-labelledby` automatically wired to the headline. The `<SectionMarker>` middle dot is intentionally always copper because the marker primitive is single-tone; for non-copper tones, use `markerIcon` to carry the matching accent.

Consumers: every `/admin/*` page (positions, candidates, whitelist, election, internal, public, results, exports, admins, dev, the index dashboard) plus `<ImportSummaryStrip>`.

### `<LinkButton>` — `components/ui/link-button.tsx`

A Next.js `<Link>` styled like the project's `<Button>`, rendered as a single `<a>` element so the codebase stops shipping invalid `<a><button>` nesting wherever a CTA happens to navigate. Same `variant` × `size` matrix as `<Button>`; the constants are intentionally duplicated and labelled "keep in sync with `components/ui/button.tsx`".

```ts
interface LinkButtonProps extends Omit<LinkProps, "className"> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  children: React.ReactNode;
}
```

When `target="_blank"` is passed, `rel` defaults to `"noopener noreferrer"` for external-link safety unless the caller provides an explicit `rel`. There is no `loading` state — an anchor cannot be busy in the same sense as a `<button>`; escalate if a future caller needs it.

Consumers: `app/(authed)/admin/election/page.tsx`, `app/(authed)/admin/positions/page.tsx`, `app/(authed)/admin/candidates/page.tsx`, `app/(authed)/admin/whitelist/page.tsx`, `app/(authed)/admin/internal/page.tsx`, `app/(authed)/admin/public/page.tsx`, `app/(authed)/admin/results/page.tsx`, plus `components/admin/no-election.tsx`.

### `<ImportSummaryStrip>` — `components/admin/import-summary-strip.tsx`

The per-row import summary block the admin tree shows after a CSV upload or pasted-input import: a stat row (Added / Reclassified / Skipped / Errors / Warnings), two scrollable issue lists with row labels, and a dismiss control. Wraps `<NoticeStrip>` so the section marker, headline, copper border, and `--paper-2` ground come from the canonical surface; the strip never restyles its host.

```ts
interface ImportSummaryEntry {
  displayRow: string;   // e.g. "Row 12" or "Line 3, item 2"
  email?: string;       // optional row identifier rendered between row + reason
  reason: string;       // one-line plain-English reason
}

interface ImportSummaryStripProps {
  markerPrimary: string;
  markerSecondary?: string;
  headline: string;
  stats: {
    added?: number;
    reclassified?: number;
    skipped?: number;
    errors?: number;
    warnings?: number;
  };
  errors?: ReadonlyArray<ImportSummaryEntry>;
  warnings?: ReadonlyArray<ImportSummaryEntry>;
  onDismiss: () => void;
  tone?: "copper" | "destructive" | "neutral";  // defaults to destructive when errors > 0, else copper
}
```

The error reason renders in `--copper` to telegraph "this row needs action"; the warning reason stays in `--ink-muted` so warnings read as "informational, no fix required". Match this distinction in any future caller — do not invent a third reason-color. Section labels read **"Errors: these rows did not import"** and **"Warnings: imported with a fallback"** (colon-separated per the em-dash ban; see *Voice & UX copy rules*).

Consumers: `app/(authed)/admin/whitelist/page.tsx`, `app/(authed)/admin/candidates/page.tsx`. Slated for `/admin/exports` export-failure summaries when that surface needs it.

### `<Badge>` — `components/ui/badge.tsx`

The single status / role chip primitive.

```ts
type Tone = "neutral" | "brand" | "copper" | "success" | "warning" | "destructive" | "muted";

function Badge(
  props: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }
): JSX.Element;
```

Default tone is `"neutral"` (`--color-secondary` ground). Always paired with a leading icon and a text label; never icon-only and never colour alone. The `copper` tone (Tier 4 addition) maps to `--color-accent` (= `--copper`) and is reserved for the super-admin / committee-role accent ladder documented under *Status badge convention*.

Consumers: every page in the authed app that surfaces a status or role label, including `app/(authed)/dashboard/page.tsx`, `app/(authed)/vote/page.tsx`, `app/(authed)/internal/page.tsx`, `app/(authed)/results/page.tsx`, plus the `/admin/*` tree.

### `formatMYT` / `formatMYTTimeOnly` / `formatMYTFilenameStamp` — `lib/format.ts`

Deterministic Malaysia-Time formatters used across every voter-facing surface. The AGM is run from Penang; scheduled windows, ballot timestamps, and confirmation receipts are quoted in MYT regardless of the viewer's locale so a voter abroad reads the same wall-clock time the chairperson sees on stage. All three formatters are bound to `Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", … })` rather than `toLocaleString()` without an explicit locale, because Node and the browser disagree on default-locale defaults and would silently shift the rendered string between server-rendered first paint and client hydration.

```ts
formatMYT(ms: number): string;             // "Wed, 12 Nov 2026, 14:30 MYT" — full receipts, audit timestamps
formatMYTTimeOnly(ms: number): string;     // "14:30 MYT" — when the surrounding context already has the date
formatMYTFilenameStamp(ms: number): string; // "20260510T1433-myt" — sortable, Windows-safe CSV / archive suffix
```

**Render-clock discipline.** `formatMYT(...)` callers must pass either a persisted timestamp (e.g. `myVote.votedAt`, `entry.createdAt`) or a state-captured value, never a fresh `Date.now()` read inside JSX. Render-time `Date.now()` flickers on every reactive re-render of an underlying Convex query and is treated as a leak.

Consumers: `app/(authed)/vote/page.tsx`, `app/(authed)/internal/page.tsx`, `app/(authed)/results/page.tsx`, `app/(authed)/dashboard/page.tsx`, plus the entire `/admin/*` tree.

### `<SignInButton>` — `components/auth/sign-in-button.tsx`

Smaller secondary-surface sign-in trigger. Uses the `useMicrosoftSignIn` hook; renders as the project's standard `<Button>` with the "Sign in with USM email" label.

```ts
function SignInButton(props: { size?: "sm" | "md" | "lg"; className?: string }): JSX.Element;
```

Vocabulary stays USM-student-facing: **"Sign in with USM email"** rather than "Sign in with Microsoft". The OAuth provider underneath is Microsoft (USM accounts are Outlook), but no student recognises their account by that name. The Microsoft mark is deliberately omitted to keep the surface speaking the student's vocabulary.

Currently no consumers — the landing routes through `<SignInCTA>`. Documented as the canonical fallback for any future authed-side surface that needs an in-page sign-in trigger without the premium Button-in-Button treatment.

### `<SignInCTA>` — `components/landing/sign-in-cta.tsx`

The premium Button-in-Button sign-in CTA for the landing hero. Ink fill on paper with a nested 9 × 9 capsule that holds the trailing arrow icon. Magnetic hover (capsule slides 0.5 px on hover), tactile press (`active:scale-[0.98]`), 700 ms transitions on the project's signature ease curve.

```ts
function SignInCTA(): JSX.Element;
```

This is the brand-register reference for high-stakes loud-surface CTAs and the only `<SignInCTA>` consumer should be the landing hero (`app/page.tsx`). Any future loud-surface CTA that wants the Button-in-Button treatment should clone the structure (label span + nested capsule with trailing icon) rather than re-skin a different button primitive.

Consumers: `app/page.tsx`.

## Status badge convention

Every status / role badge follows a fixed ladder. **Text label + dot/icon + shape; never colour alone.**

- **Copper (`tone="copper"` → `--color-accent` / `--copper`).** Super-admin chip, Head Executive, accent role on `/admin/admins`. The "this is the privileged identity" chip across the audit log and the admin allowlist. Reserved for the topmost role layer.
- **Brand (`tone="brand"` → `--color-brand` / `--teal`).** Primary brand identity. Used on the dashboard tier marker, the rubric save bar's "Draft" state, the active-cycle pill, the live ballot's "Tier N" highlight.
- **Muted (`tone="muted"` → transparent ground, `--color-muted-foreground` text, `--color-border` outline).** Structural identity that needs to read as "label, not status." Voter-class chips on the whitelist, position-status chips when the position is dormant.
- **Warning (`tone="warning"` → `--color-warning` / `--acid`, `--ink` text).** Semantic warning states: "blocking tie", "internal evaluation closed early", "incomplete rubric saved as draft". Carries an icon (`AlertTriangle`) every time.
- **Success (`tone="success"` → `--color-success`).** Submitted, completed, published. Always paired with a `CheckCircle2` icon.
- **Destructive (`tone="destructive"` → `--color-destructive`).** Critical failures, irreversible "Removed" or "Locked out" states. Used sparingly; almost every admin-facing destructive operation reaches for the destructive `<Button>` variant rather than a destructive chip.
- **Neutral (`tone="neutral"` → `--color-secondary`).** The default fallback. Used for "draft", "pending", "unscheduled", and every state that isn't yet semantically loaded.

Two operating rules across the ladder:

- **One tone per row.** A list row carrying a copper chip should not also carry a brand chip and a warning chip; pick the most semantically loaded tone and let the others fall back to neutral or muted.
- **Live states must visibly differ from their inactive counterparts at a glance.** "Voting open" carries a colour, an icon, and a different shape (filled chip vs outline chip); "Voting closed" is neutral.

## Voice & UX copy rules

(See `PRODUCT.md` → Brand Personality → Voice for the full statement; the design-relevant excerpts:)

- **State the state, specifically.** *"Internal evaluation closed Friday 17 May, 23:59 MYT"* beats *"Voting is no longer available right now."*
- **Plain English for failures.** No raw stack traces, Convex `ConvexError` payloads, or Firebase exception text in the UI. Every error includes a recovery action and (when applicable) a contact. Surface translation goes through `lib/convex-error.ts` (`getConvexErrorMessage`).
- **No em dashes (`—`) in UI copy.** Use commas, colons, semicolons, periods, or parentheses. Also not the ASCII `--`. The en dash `–` is permitted *only* for numeric ranges (e.g. *"60–75% of the final result"*). The closeout copy sweep cleared every UI-copy hit; only JSDoc / file-level docstrings / CSS comments retain em-dashes.
- **Tone**: never cute, never apologetic, never marketing-speak. If you wouldn't write it on a printed institutional notice, don't put it in the UI.

## Banned by default

Absolute design bans on this project. If you find yourself reaching for one, rewrite the element with different structure:

- **Side-stripe borders.** `border-left` or `border-right` greater than 1 px as a coloured accent on cards, list items, callouts, alerts. Never intentional. Use full borders, background tints, leading numbers/icons, or nothing.
- **Gradient text** (`background-clip: text` + gradient background). Decorative, never meaningful. Use a solid colour and earn emphasis with weight or scale.
- **Glassmorphism as default surface.** The `surface-glass` utility exists for rare considered moments. It is not the default card treatment.
- **Hero-metric template** (big number + small label + supporting stats + gradient accent). SaaS cliché.
- **Identical card grids** (same-sized cards with icon + heading + text repeated endlessly).
- **Modal-as-first-thought** for state changes that could happen inline.
- **Default browser `alert` / `confirm` / `prompt`.** Always go through `sonner` or a custom dialog.
- **Visible colour-mixing seams in CSS gradients.** If a gradient shows banding or a hue shift mid-bezel, redo it with OKLCH stops or replace it with a solid surface.
- **Animated decoration on a live ballot or rubric form.** Hard rule, repeated from Motion above because it is the most-violated one.
- **`Date.now()` inside JSX.** Render-time clock reads flicker on every reactive re-render. Use a persisted timestamp from the underlying Convex record, or capture once at the moment of action and render from state thereafter.
- **Em-dashes (`—`) and ASCII double-hyphens (`--`) in UI copy.** See *Voice & UX copy rules*.
- **Inter / Playfair Display / DM Sans / IBM Plex / Outfit / Cormorant** and the rest of the brand-register reflex-reject list as new type choices.

## What this file does not lock (and why)

Intentionally absent from this pass:

- **Per-component shadow scale.** The current primitives use ad-hoc shadows (`shadow-sm` on `<Card>`, the bespoke `0_18px_45px_-20px_rgba(11,15,18,0.55)` on `<SignInCTA>`, the `shadow-lg` on the rubric save bar, the `shadow-xl` on dialogs). A documented shadow vocabulary (`ambient-low` / `ambient-mid` / `dialog` / `cta`) is worth a separate pass; the current set works but is not yet a system.
- **Exact OKLCH precision audit.** The hex values in `app/globals.css` are the working defaults the locked landing was tuned against; the OKLCH approximations in *Colour tokens* are documented from intent, not measured. A full per-pair WCAG audit (every foreground × every background, every hover state, every disabled state) is a future pass.
- **Dialect unification: `--color-*` vs paper-direct.** The two token systems coexist intentionally (paper-direct for editorial voice on every surface; shadcn-dialect for lower-level chrome on `<Card>`, `<Button>`, `<Badge>`). A future pass may collapse one into the other; do not pre-empt that decision in new code.

## Future audit candidates

Captured here so the next design or hardening pass has a starting list, not because any of these is blocking the current sweep:

- **OKLCH precision audit** on every paper-direct and `--color-*` token, plus a full WCAG AA × AAA pairing matrix. Replaces the approximate values in *Colour tokens* with measured ones and resolves the deferred OKLCH question above.
- **Dialect unification** between `--color-*` (shadcn-derived) and the paper-direct primaries. Either collapse the shadcn dialect onto the paper-direct names or formalise the boundary so primitives know which dialect to reach for. Do not start until the OKLCH precision audit is done; the two passes are entangled.
- **`<RoleChip>` / `<ClassChip>` extract.** The Tier 4 sweep landed inline `<Badge tone="copper">…</Badge>` patterns on `/admin/admins` and inline voter-class chips on `/admin/whitelist`. A `<RoleChip role="super" | "admin" | "committee" | "voter">` and a `<ClassChip class="year-1" | "year-2" | …>` would consolidate those.
- **`<FilterChipGroup>` extract.** Every admin filter row currently inlines a row of `rounded-full border` chips. A shared primitive for the filter pattern would let the active / inactive / count states stay consistent across surfaces.
- **`<DataTable>` extract.** The wide admin tables (`/admin/internal`, `/admin/whitelist`, `/admin/exports`) repeat the same `border border-[var(--ink-line)] bg-[var(--paper)]` shell, the same column-header `font-mono text-[10.5px] uppercase tracking-[0.18em]` treatment, and the same `tabular-nums` numeric cells. A documented `<DataTable>` primitive would lock the convention.
- **Mobile layout for `/admin/internal`'s wide rubric table.** The desktop layout is the right shape on a laptop but is hard to read on a 360 px viewport. A column-first variant (one criterion per row, candidates as filterable groups) is worth scoping.
- **Self-demotion server guard on `convex/admins.ts:grantAdmin`.** Auth hardening, not design — but flagged here so the user has one consolidated list. A super-admin should not be able to demote themselves below admin in a single transaction without an explicit confirmation flow.
- **Per-component shadow scale.** See *What this file does not lock*. Worth its own pass once the OKLCH audit is done so shadow tints stay coherent with the locked palette.
