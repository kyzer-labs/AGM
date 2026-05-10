# AGM Testing Playbook

Strategy for verifying the end-to-end election flow when you only have
a small number of real `@student.usm.my` accounts. Everything is driven
from `/admin/dev` in the browser; there are no shell scripts. Three
layers, in order of cost and time:

1. **Layer 1 — Convex dev seeder.** Server-side seed mutations in
   `convex/dev.ts`, exposed in the admin UI at `/admin/dev`. Populates
   synthetic voters, the eighteen-candidate fixture slate, whitelist
   rows, internal evaluations, and public votes so the scoring math,
   cascade, and tie-break ladder can be exercised at scale. The page's
   live inventory replaces every previous status check command.
2. **Layer 2 — Pre-baked scenarios.** Buttons in the dev seeder for
   common deterministic setups: "happy path", "engineered tie".
3. **Layer 3 — Real-account smoke test.** Two `@student.usm.my`
   accounts walk through the actual flow on top of seeded data to
   verify Microsoft SSO, profile completion, real submission paths,
   and AGM-day operations.

> Layer 4 (Firebase Auth Emulator + Playwright) is intentionally out of
> scope for now.

---

## Layer 0 — Enable the dev seeder

The seeder is gated behind a Convex deployment env var so it never
ships to production by accident.

```bash
# On your DEV Convex deployment only
bunx convex env set DEV_SEED_ALLOWED true

# Verify
bunx convex env get DEV_SEED_ALLOWED
```

After setting it, restart `bunx convex dev` so the new env is picked
up. Confirm the gate is live by:

- Visiting `/admin` while signed in as an admin — a "Dev seeder" tile
  appears.
- Visiting `/admin/dev` — the page loads with a yellow "Dev only"
  badge.

To turn the seeder off, unset the var:

```bash
bunx convex env unset DEV_SEED_ALLOWED
```

> **Never set `DEV_SEED_ALLOWED` on the production Convex deployment.**
> All seed mutations check this on the server. Even if a malicious
> client tried to call them directly, they'd fail.

---

## Layer 1 — Synthetic data via `/admin/dev`

The dev seeder writes rows whose email shape is:

```
seed-<class>-<nnn>-<short>@student.usm.my
```

where `<class>` is `tc | he | y2 | ext` and `<short>` is the last 8
characters of the election cycle's Convex ID. **Wipe operations only
touch rows matching this pattern**, so real voters and real whitelist
entries are never deleted.

Audit log entries from this module use the `dev.seed*` action prefix
so you can filter them out of any export.

### Common building blocks

Each card on `/admin/dev` calls one Convex mutation. From top to
bottom:

| Card | Mutation | What it does |
| --- | --- | --- |
| Test candidate fixtures | `dev.loadTestCandidates` / `dev.wipeTestCandidates` | Loads the eighteen `[TEST_FIXTURE]` candidates (two per position across all three tiers). Wipe removes only fixtures; real candidates from `/admin/candidates` are kept. |
| Voter pools — evaluators | `dev.seedEvaluatorVoters` | Creates seed `voters` rows + adds them to the internal whitelist with the correct class |
| Voter pools — external | `dev.seedExternalVoters` | Creates seed `voters` rows that are **not** whitelisted; used as the pool for public votes |
| Internal evaluations | `dev.seedInternalEvaluations` | Writes the full N×M×K rubric matrix for every seeded evaluator. Distributions: `uniform` (seeded random), `perfect` (all max), `favorFirst` (first candidate wins per `_id` sort) |
| Public votes | `dev.seedPublicVotes` | Allocates `totalVotes` to candidates per position. `kind: "uniform"` for even split, `"favorFirst"` for ~70/30 |
| Engineered tie | `dev.engineerTieAtPosition` | Equalises class shares **and** vote counts between the position's top two candidates so the ladder bottoms out at `manual` |
| Happy path scenario | `dev.runHappyPathScenario` | One-shot: voters + whitelist + submitted evaluations using the chosen distribution |
| Wipe seed data | `dev.wipeSeedData` | Deletes seed-only rows scoped to this cycle. Resets every position's session status to `pending` and clears the `results` table. Does **not** touch `[TEST_FIXTURE]` candidates. |
| Wipe everything | `dev.wipeAll` | One-shot teardown: every `seed-*` row plus every `[TEST_FIXTURE]` candidate, scoped to this cycle. Real data and the cycle/positions/rubric configuration are preserved. |

### Live inventory

The "Seed inventory" panel at the top of `/admin/dev` is reactive: it
re-renders any time a seed mutation completes. Use it as the source of
truth for "is the test setup ready" — there is no longer a status
script. The panel shows seed voters, seed whitelist (broken down by
class), seed evaluations / drafts, seed public votes, fixture
candidates vs real candidates, position session status counts, and
results computed so far.

The "Test candidate fixtures" card has an expandable
**First-by-position breakdown** that lists, for each position:

- Which candidate would win under `favorFirst` evaluation distribution
  combined with `favorFirst` public votes (the predictable winner).
- Whether that candidate is a fixture (`[TEST_FIXTURE]`) or a real
  candidate.
- Each position's current session status (pending / active / closed).

Use it to verify scoring math after a happy-path run without leaving
the page.

### Phase requirements

Most seed operations only fire in specific phases so they don't
contradict the runbook's expectations:

| Operation | Allowed phases |
| --- | --- |
| Load test candidates | `setup` |
| Wipe test candidates | any except `published` |
| Seed evaluator voters | `setup`, `internalOpen` |
| Seed internal evaluations | `setup`, `internalOpen`, `internalClosed` |
| Seed external voters | any except `published` |
| Seed public votes | any except `published`, but only meaningful in `publicVoting` (closing a ballot is what runs the math) |
| Engineered tie | any except `published` |
| Wipe seed data | any except `published` |
| Wipe everything | any except `published` |

Use the existing `/admin/election` page to advance phases between
seed steps — the seeder does not move phases for you. The
`/admin/dev` page also has a **Phase quick-jump** card that links to
every admin surface so you can drive the cycle in another tab while
this page's inventory updates live.

---

## Layer 2 — Two pre-baked scenarios with hand-verifiable math

### Scenario A — Happy path with a clear winner per position

Tests: full election flow, internal class share normalisation, public
vote contribution, weighted final score, results publishing.

**Pre-conditions:**

- Cycle is in `setup` with the default 9 positions seeded
  (`/admin/positions` → "Seed defaults"), at least 2 candidates per
  position, weights configured, rubric configured.
- 2 admin accounts: one super (you), one regular (or just yourself
  twice). Real accounts not strictly needed for this scenario, but
  see Layer 3.

**Steps:**

1. `/admin/dev` → click **Run happy path scenario** with:
   - `Top Committee = 4`, `Head Executive = 3`, `Year 2 Committee = 3`
   - `External voters = 40`
   - `Distribution = favorFirst`
2. `/admin/election` → **Open internal**. Setup readiness should be
   green now (every weighted class has ≥1 evaluator).
3. `/admin/internal` → confirm 10 submitted evaluations, all classes
   represented. Aggregate view shows the first-by-`_id` candidate at
   the top of every class.
4. `/admin/election` → **Close internal**, then **Move to public
   voting**.
5. `/admin/dev` → click **Seed public votes** with
   `votes per position = 30`, `kind = favorFirst`.
6. For each position in tier+order on `/admin/public`:
   1. **Start ballot** (uses real session machine).
   2. **Close ballot**. The first candidate should win every position
      via `tieBreakStep: "finalScore"`.
7. `/admin/election` → **Move to results preview**.
8. `/admin/results` → confirm:
   - Every position's winner is the first-by-`_id` candidate.
   - Internal aggregates match: with `favorFirst`, the first candidate
     gets a class share of approximately
     `tc_max / (tc_max + (n-1)*tc_low)` where `tc_max ≈ 5*K` and
     `tc_low ≈ 1.5*K` (K = number of criteria, default 5). For 4
     candidates: `25 / (25 + 3*7.5) = 25/47.5 ≈ 0.526`.
   - Public share for first ≈ 0.7, others split 0.3 evenly.
   - `tieBreakStep` is `finalScore` for every row.
9. **Publish all results**. `/results` (public) should now show the
   breakdown.

### Scenario B — Engineered tie that bottoms out at manual

Tests: tie-break ladder, manual resolution, audit log, position
session machine refusing the next ballot until the tie is resolved.

**Pre-conditions:** same as Scenario A, but skip Scenario A or
**wipe seed data** between runs to start from a clean slate.

**Steps:**

1. Run Scenario A through step 4 (cycle is in `publicVoting`, every
   position pending).
2. `/admin/dev` → **Engineered tie** at `President`, `votes per top
   candidate = 10`. This sets every seeded evaluator to give the top
   two candidates max scores (identical), and writes 10 votes for
   each.
3. `/admin/public` → start the President ballot, then close it.
4. The result row should show `tieBreakStep: "publicShare"` (since
   class shares and public shares are all tied at the same value, the
   ladder will exhaust). The "Resolve tie manually" panel appears.
5. Try to start the next ballot — it should refuse with
   "Resolve the previous position's tie before opening another
   ballot."
6. Resolve the tie, picking either of the two candidates and writing a
   reason ≥ 3 chars. Move on to the next ballot. The result row
   updates to `tieBreakStep: "manual"` with your reason recorded.

> The ladder steps `tcShare → heShare → y2Share` only kick in if the
> class scores actually differ. Because Scenario B writes max scores
> for the top two from every class, we expect those to tie too — the
> winner is decided either at `publicShare` (if you skewed votes) or
> `manual` (if votes are also tied). Adjust `votes per top candidate`
> to flip between the two outcomes.

### Repeating with hand-verifiable math

The `uniform` distribution uses a seeded PRNG keyed on
`distribution + evaluator._id`. Re-running with the same seed voters
produces **the same scores**, so once you've hand-verified the
expected internal aggregates from one run, you can re-run the same
scenario and assert byte-equal numbers.

To force completely deterministic math, prefer `perfect` (all max)
and `favorFirst` (5 vs ~1.5) over `uniform`.

---

## Layer 3 — Real-account smoke test (2 accounts, ~30 minutes)

Goal: verify everything **the seeder cannot** — Microsoft SSO, profile
completion, real evaluation submission, real public voting, photo
uploads to Convex storage, and AGM-day operations on top of seeded
data.

### Account hats

Assign roles to your two real accounts up-front:

- **Account A** = super admin. Boots the cycle, runs `/admin/*`,
  drives the AGM-day session machine.
- **Account B** = "the human", rotated through three role hats in
  this order. Sign out / sign in between hats only if needed; usually
  just changing the whitelist + role works without re-auth.

### Walkthrough

Pre: cycle exists in `setup`, default positions seeded, candidates
imported (real photos + bios), rubric configured, weights configured.

1. **Account A signs in** — verify Microsoft popup → USM domain check
   → ensures voter row → bootstrap super admin (only the first time)
   → completes profile.
2. **Account B signs in** — same flow, but stops at "you are not on
   the whitelist and there is no active public ballot, please wait".
3. **Account A** adds Account B to the whitelist as `topCommittee`.
4. **Account A** opens `/admin/dev` and runs **Run happy path
   scenario** with TC=4, HE=3, Y2=3, externals=40. This adds *seeded*
   evaluators **alongside** Account B in the whitelist; Account B's
   real human evaluation will replace any synthetic data for B's
   email.
5. **Account A** moves the cycle to `internalOpen`.
6. **Account B** signs in, sees the rubric, scores every candidate,
   submits. Verify the badge changes from "Draft" to "Submitted" and
   the admin completion list at `/admin/internal` shows B as
   submitted.
7. **Account A** closes `internalOpen`. Re-classify Account B from
   `topCommittee` → `headExecutive` on `/admin/whitelist`. Reopen the
   internal window (allowed transition: `internalClosed` →
   `internalOpen`). Account B re-submits with the new class hat.
   Verify `/admin/internal` aggregates now show B's votes counted
   under HE share.
8. **Account A** removes Account B from the whitelist entirely and
   closes the internal window. Move the cycle to `publicVoting`.
9. **Account A** seeds public votes from `/admin/dev`
   (votes per position = 30, kind = favorFirst).
10. **Account A** starts the President ballot. **Account B** signs in,
    sees `/vote`, confirms the position name, picks a candidate,
    confirms, sees the success state, refresh — vote stays cast.
    `/admin/public` live counts on Account A reflect Account B's vote
    + 30 seeded votes (= 31 total).
11. **Account A** closes the President ballot. The result row
    computes immediately. Continue down through every position. **B
    cannot vote a second time** for the same position — verify the
    error.
12. **Account A** moves to `resultsPreview` then publishes. **B**
    refreshes `/results` (public page) and sees the published
    breakdown with the 60/40 split visible.

### Things only this layer catches

- Microsoft tenant restriction (`NEXT_PUBLIC_MICROSOFT_TENANT`) and
  USM domain rejection.
- The Firebase popup → Convex auth handshake.
- Photo upload to Convex storage (seed candidates use no photos by
  default; upload one manually for at least one candidate).
- Sign-out flow + session persistence (refresh the page mid-flow,
  expect to stay signed in).
- The completion-of-profile redirect to `/profile/complete`.
- The "you already voted" branch on `/vote`.
- Real audit log entries with real `actorEmail`s, not the seed prefix.

### Cleanup

After the smoke test:

1. **Account A** chooses one wipe mode at `/admin/dev`:
   - **Wipe seed data** keeps the test candidate fixtures and real
     candidates, and removes only `seed-*` voters and their downstream
     rows. Use this when you want to re-run a different distribution
     against the same candidate slate.
   - **Wipe everything** removes the seeded voters and the
     `[TEST_FIXTURE]` candidate slate in one shot. Use this when
     you're starting from a fresh fixture slate.
2. Decide whether to keep this cycle as your dev/staging rehearsal
   data or `/admin/election` → delete (Setup phase only) and start
   over for the next rehearsal.
3. If you want a fully clean cycle, advance back to `setup` first
   (allowed from `internalOpen` only) — but note that wipe also
   resets sessions, so you can usually skip this.

---

## Frequently asked

**Is the audit log polluted by seeds?**
Each seed mutation writes exactly one audit entry per call (no
per-row spam), prefixed with `dev.seed*`. To filter them out of any
CSV export, drop rows where `action LIKE 'dev.%'`.

**Why do seeds need to run as an admin?**
The dev mutations still call `requireAdmin(ctx)` so unauthenticated
clients can't trigger them. The admin's voter row also serves as the
audit log actor, so you know who seeded what.

**Can I run two test cycles side-by-side?**
Yes — seeds are scoped by election ID's last 8 characters in the
synthetic email, so two cycles will get disjoint seed pools. Wipe is
also election-scoped.

**The setup readiness check fails when I open internal.**
The default weights have non-zero TC/HE/Y2. Make sure the
"Seed evaluator voters" form has counts ≥1 in each non-zero-weight
class. If you've zeroed a class's weight in Setup, that class can be
left at 0.

**My seeded scores don't show up in `/admin/internal` aggregates.**
Aggregates only count `submitted` evaluations. Either re-run with
"Mark as = Submitted" in the form, or set the toggle when running the
happy path scenario.

**The seeded public votes don't appear at the top of the live count.**
Live counts at `/admin/public` only include votes for the **active**
ballot. Votes for un-opened or closed ballots show up after the
session is closed and the result is computed.
