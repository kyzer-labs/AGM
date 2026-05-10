# Product

## Register

product

## Users

The USM Computer Science Society Annual General Meeting (AGM) is an annual democratic event where the outgoing Year-2 committee passes leadership to the incoming Year-1 cohort. The portal serves four distinct user types, each with a narrow, single-purpose surface:

- **External voters** — Year-1 committee members and any signed-in `@student.usm.my` student who is not on the Year-2 internal whitelist. They use the site exactly twice: once to complete a voter profile, once during the live AGM to cast one ballot per active position. Most spend under five minutes here all year. They arrive on AGM day under social pressure, often on a phone, often during a noisy in-person meeting.

- **Internal evaluators** — Year-2 committee members on the internal whitelist. They use the site once during the internal evaluation window (typically the week before AGM) to score every active candidate against a five-category rubric (Leadership, Teamwork & Communication, Professionalism & Ethics, Commitment, Personality). Internal evaluation carries 60–75% of the final result depending on the admin-configured cycle weightage, so this surface must feel like a serious responsibility, not a survey.

- **Admins** — committee operators who configure the cycle (positions, candidates with photos, internal whitelist via CSV), open and close evaluation and voting windows, monitor live counts during AGM, resolve manual ties, and publish results. On AGM day they operate the portal in real time in front of a live room of voting members.

- **Super admin / election operator** — the trusted person or small team responsible for bootstrapping the first admin, managing the allowlist, recording manual override reasons, and exercising emergency audit access (voter-to-choice mapping) when justified. Almost never used; must be unmistakable when it is.

Context: the portal is dormant for roughly fifty weeks of the year, then absolutely critical for two windows — the internal evaluation week and the live AGM event itself. Trust during those two windows is the entire product.

## Product Purpose

Run a free, fair, auditable AGM election that combines candidate-level internal rubric evaluation with live AGM-day public voting, normalises both components separately so turnout differences cannot distort the split, combines them at admin-configured weightage, and publishes results that stand up to public scrutiny.

The system must prevent the operational mistakes that previous AGM portals made (hardcoded candidate data, shared admin passwords stored in frontend env vars, vote-weighting distorted by turnout, missing pre-AGM internal evaluation flows, partial submissions affecting results), while staying simple enough that a single operator can run AGM day without a custom local backend.

Success looks like:

- Every eligible voter casts exactly one vote per active position.
- Every internal evaluator submits a complete rubric or none at all (no partial scores leaking into results).
- Combined results are calculated transparently and the 60/40 (or whatever the cycle weightage is) split is visible on the published page.
- Manual tie resolutions and admin actions are audited.
- The live event runs without manual recovery, browser-tab-juggling, or "ssh into prod" moments.
- The published results page becomes the source of record that the next year's committee, advisors, and any auditing party reference.

## Brand Personality

**Editorial · Technical · Deliberate.** A research lab that happens to run elections.

- **Editorial.** The portal reads like a printed institutional document, not a marketing page. Considered typography, labelled metadata, columns when columns earn their place, long-form reads where the situation calls for them. The act of casting a ballot should feel like signing a register, not submitting a form.

- **Technical.** Built by the CS Society for the CS Society — the audience is technically literate. Monospace as body type is not an affectation; it is an honest signal of the audience. Status codes, technique labels, system metadata are surfaced rather than hidden behind friendly euphemisms.

- **Deliberate.** Every element earns its place against the question "would a careful editor leave this in?" Restraint scales with stakes: ambient and considered decorative effects are permitted on the dormant landing page and the celebratory published-results surface; the active voting, rubric scoring, and state-changing admin surfaces stay quiet, focused, and free of competing motion.

**Voice.** Plain English, specific over vague, never cute, never apologetic. State the state — "Internal evaluation closed Friday 17 May, 23:59 MYT" — rather than soften it — "Voting is no longer available right now." Tell users what they can do next, who to contact, and when the next window opens.

**Emotional outcome.** Ceremonial civic gravity. Voters and evaluators should feel they are participating in a real institutional moment, not filling out a Google Form. Trust comes from the system clearly knowing what it is doing.

## Anti-references

This portal must NOT look like:

- **Generic AI-SaaS dashboards.** No Inter as the body font. No AI-purple gradients. No identical 3-card hero-metric grids. No glassmorphism as a default surface treatment. No lavender CTAs. None of these dialect markers belong on a civic surface.

- **Google Forms / Microsoft Forms / SurveyMonkey.** The system must never read as a generic survey tool. Voting is not a poll. Rubric scoring is not a satisfaction survey.

- **Corporate shareholder-voting platforms.** Heavy gray tables, navy-and-gold colour schemes, IBM Plex everywhere, AGM-as-quarterly-report. We are a student society, not a publicly listed company.

- **Generic Malaysian institutional sites** (gov.my, .edu.my templates). Clip-art seals, multi-color rainbow buttons, dated stock photos, justified walls of text, mid-2000s portal aesthetics. The fact that the audience is Malaysian university students does not justify defaulting to that visual culture.

- **Decorative motion during the vote moment.** No shader fireworks behind a live ballot. No animated backgrounds behind a rubric form. No celebratory confetti when an evaluator submits. Ambient motion is permitted on the landing page, on dormant waiting screens, and on the published-results surface — never on a state-changing form.

**Positive reference vector.** Roughly the considered restraint of **Linear** and **Stripe** + the technical confidence of **Vercel / Geist's** monochrome-with-an-accent product UI + the editorial scaffolding of the existing **lab-notebook** direction (cream paper, ink, grid overlay, monospace metadata, considered shader backdrops as quiet artistic statements rather than decoration). The locked landing direction (Sumi-e Drift, perf-hardened to Whisper Lines's render budget) lives at `app/page.tsx`; the rationale is captured in `docs/landing-rendition-brief.md`. Exact OKLCH palette values are still pending the `/impeccable document` token-propagation pass — `app/globals.css` carries the working defaults the locked shader was tuned against.

## Design Principles

1. **Honest scaffolding over decoration.** The grid, the monospace metadata, the small uppercase technique labels, the numbered section markers — these are the *structure* of the document, not ornament. Anything purely decorative must justify itself against that test or be cut.

2. **Restraint scales with stakes.** Express on the dormant landing and the celebratory published-results page. Go quiet around the active vote, the rubric form, the admin actions that change election state, and any irreversible publish moment. The vote moment is sacred — nothing animated should be competing for the voter's attention while a ballot is open.

3. **Audited by design.** Every privileged action is visible *in the interface itself*: who can perform it, what state it leaves the system in, whether it is reversible, and where the audit log is. Audit is a feature people see, not just a backend table they're told exists.

4. **Once-a-year, earned.** Most users see this portal for five minutes per year. That window must feel like the institution they are voting for, not a side-project an intern threw together. Concentrate polish density on the surfaces real users actually touch — sign-in, profile completion, the ballot, the published results — before polishing admin internals.

5. **Quiet credibility through showing the work.** The audience is technically literate. Use monospace, surface system metadata, label states explicitly, refuse to dumb information down. Trust is earned by showing structure, not by hiding it behind a friendly skin.

## Accessibility & Inclusion

- **WCAG 2.2 AA contrast minimum** on every text and interactive element across every surface (≥4.5:1 for body text, ≥3:1 for large text and UI components). Push to AAA wherever it does not fight legibility.

- **Fully keyboard-operable.** Sign-in, profile completion, the ballot, rubric scoring, every admin operation, every export — reachable with the keyboard alone, with visible `:focus-visible` rings on every interactive element. No mouse-only interactions, no `pointer-events`-only controls, no drag-only flows without a keyboard equivalent.

- **`prefers-reduced-motion` honored everywhere.** Tile-enter animations, standby pulses, shader backdrops, and any future motion must collapse to static or near-static when the user requests it. Already partially implemented in `app/globals.css`; treat it as a rule, not an option, on every new surface.

- **Status is never communicated by colour alone.** Active / completed / pending / error / success states use icons, text labels, and shape *in addition to* colour, so colour-blind users receive the same signal as everyone else.

- **Voter-facing errors stay plain.** Raw stack traces, Convex `ConvexError` payloads, Firebase exception objects, and developer language never reach end users. Every failure surfaces as plain English with a concrete recovery action ("Sign in again", "Contact `<committee email>`", "Try again once the window opens at `<time>`"). This rule is enforced *everywhere* a UI renders failure — sign-in, ballot submission, profile completion, admin mutations, exports — not just at one boundary.

- **Mobile-first for the voter surfaces.** External voters arrive on AGM day on phones, in a noisy live event. The ballot, profile completion, and waiting states must work cleanly at 360 px wide before they're allowed to look impressive at desktop widths. Admin and rubric-evaluator surfaces may prioritise larger viewports.
