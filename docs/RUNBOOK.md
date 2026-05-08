# AGM Operations Runbook

A practical, step-by-step guide for running an AGM cycle with this app.
Skim it once before the event, keep it open during.

---

## Roles

- **Super admin** — bootstraps the system, manages the admin allowlist,
  resolves ties, runs emergency lookups. Recompute / emergency override are
  super-admin only.
- **Admin** — runs day-to-day operations: setup, internal window, public
  voting, exports.
- **Internal evaluator** — committee member listed on the internal
  whitelist with one of three classes (Top Committee, Head Executive, Year
  2 Committee). Submits the rubric grid before AGM day.
- **External voter** — any other `@student.usm.my` student. Votes during
  the live AGM only.

---

## Scoring model (60/40 weighted-classes)

The final score is **internal aggregate (configurable, default 60%) +
public vote (configurable, default 40%)**. Internally, three voter
classes contribute their own configurable share of the cycle:

| Class             | Default weight |
| ----------------- | -------------- |
| Top Committee     | 30%            |
| Head Executive    | 20%            |
| Year 2 Committee  | 10%            |
| Public            | 40%            |

The internal-class normalisation uses the **sum-of-totals share** method:
each class's contribution to a candidate is
`sum_of_rubric_totals_for_candidate / sum_of_rubric_totals_class_wide`.
Public uses `votes_for_candidate / total_votes_for_position`. The final
score multiplies each share by its configured weight.

Tie-break ladder, applied in this exact order:

1. `finalScore`
2. `tcShare`
3. `heShare`
4. `y2Share`
5. `publicShare`
6. **manual** — admin selects a winner with a written audit reason

Every published result records which step resolved the position.

Weights and the rubric criteria can be edited freely during **Setup**;
both are frozen the moment internal evaluation opens. To change a frozen
cycle, an admin must move the cycle back to `setup` (allowed only from
`internalOpen`) — this is audited.

---

## One-time setup (per cycle)

> All steps in this section happen on `/admin`.

1. **Create the cycle** at `/admin/election` → "Create". The cycle starts
   with the default weights and the standard 5-criterion rubric pre-seeded.
2. **Tune the weights** at `/admin/election` → "Scoring weights" if the
   defaults don't fit. Sum must equal 100%.
3. **Edit rubric criteria** at `/admin/election` → "Rubric criteria":
   add / rename / reorder / set max score (1–20) / remove. Internal
   evaluators score every candidate on every criterion.
4. **Add positions** at `/admin/positions`. The "Seed default 9 positions"
   button drops in the canonical CSS hierarchy. Reorder within each tier
   with the up/down arrows; ballot order on AGM day follows tier asc, then
   order asc.
5. **Add candidates** at `/admin/candidates`. Either add manually
   (with photo + bio) or upload a CSV with `fullName, matric, bio,
   positions` columns. The `positions` column accepts a `;`-separated list
   of position names; their order is the candidate's preference list.
6. **Import the internal whitelist** at `/admin/whitelist`. Each row
   needs an email **and** a class. Paste-box rows fall back to the
   "Default class" selector; CSV rows can include a `voterClass` column to
   override per-row. Anyone NOT on this list votes externally on AGM day.
7. **(Optional) Schedule the internal window** at `/admin/election` →
   "Internal evaluation window". Setting a start time auto-opens the
   window when setup is ready; setting an end time auto-closes. Manual
   phase changes always cancel pending jobs.
8. **Watch the readiness checklist** on `/admin/election`. The "Open
   internal" button only enables once positions, candidates, the rubric,
   the whitelist, weight sum, and **every non-zero-weight class has at
   least one evaluator** are all green.

---

## ~1 week before AGM: internal evaluation window

1. **Open** the window from `/admin/election` ("Open internal") OR let
   the scheduled job open it automatically.
2. **Notify** internal evaluators. Their landing page is `/internal`.
   Each evaluator sees their assigned class and that class's weight.
3. **Monitor** completion at `/admin/internal`:
   - submitted vs draft vs not started, filterable by class
   - aggregate per-candidate sum + per-class share + per-criterion mean
4. **Close** the window from `/admin/election` once you have enough data.
   Closing locks rubric scores forever for that cycle.

> Late additions: you can still add evaluators to the whitelist while the
> window is open, and re-classify existing rows. Both actions are audited.

---

## AGM day: live public voting

1. **Move the cycle** to public voting from `/admin/election`.
2. **Open `/admin/public`** on the operations laptop. Project the room's
   live count to the screen behind you (optional).
3. For each position in tier+order:
   1. Click "Cascade preview" if shown — confirm who is eligible after
      prior wins.
   2. Click "Start ballot". Voters' `/vote` page activates instantly.
   3. Watch the live count bar fill in. Voters' UIs lock to one selection.
   4. Click "Close ballot" when voting is complete. The result is
      computed immediately using the configured weights and the
      tie-break ladder above.
   5. **If the ladder bottoms out at "manual"**, a tie-resolver UI
      appears. Pick a winner, type a reason (>= 3 chars, recorded in
      the audit log), and resolve. The next ballot stays locked until
      you do.
4. After every ballot has a confirmed winner, move to **Results preview**
   from `/admin/election` (or the link on `/admin/results`).

---

## After voting: review and publish

1. Open `/admin/results` to inspect the per-position breakdown:
   per-class shares, internal aggregate, public aggregate, final % per
   candidate, and the tie-break step that resolved each position.
2. **Recompute** (super admin only) if you discover late corrections in
   internal scores or vote data. A reason is required.
3. **Publish** from `/admin/results` → "Publish all results".
   - Voters now see `/results` with internal aggregate vs public columns.
   - The cycle moves to `published` (terminal).

---

## Exports

`/admin/exports` provides the following downloads:

| File | Contents |
| --- | --- |
| `*-internal-scores.csv` | Per evaluator × candidate × criterion. Includes voter class, draft + submitted, configured max score per row. |
| `*-internal-scores-by-class.csv` | Aggregated per voter-class × candidate: evaluator count, sum-of-totals, class share, weighted contribution. |
| `*-public-counts.csv` | Per position × candidate vote totals (no per-voter detail). |
| `*-combined-results.csv` | The weighted output (per-class shares + public + internal aggregate + final), tie-break-step column included. |
| `*-participation.csv` | Per voter snapshot (admin/internal/external + class + activity). |
| `*-audit-log.csv` | The privileged-action log (most recent 5,000 rows). |

---

## Emergency procedures (super admin)

### A position tied even after the full ladder
- Open `/admin/public` → the affected position's tie-resolver panel
- Pick a winner, write the reason, resolve. Audited.
- The result records `tieBreakStep: "manual"` and the reason.

### A vote was cast under suspicious circumstances
- Go to `/admin/exports` → "Emergency voter audit"
- Enter the email + a reason >= 10 characters
- Review the lookup output. It is automatically saved to the audit log.
- If needed, download the per-voter CSV for incident reports.

### Need to undo a phase transition
- `/admin/election` → use the phase buttons. Going back from
  `internalClosed` to `internalOpen`, or `publicVoting` to
  `internalClosed`, is allowed and audited. The terminal `published`
  state cannot be reversed.
- Returning to `setup` is allowed from `internalOpen` only and unfreezes
  weights / rubric again. This is audited.

### Recompute a single position's result
- `/admin/results` → "Recompute" (super admin only). Required only when
  evaluations or votes have been corrected after the ballot closed.

---

## Health checks before AGM day

- [ ] All admins listed at `/admin/admins` can log in.
- [ ] Setup readiness on `/admin/election` is green (weights sum 100,
      rubric criteria configured, every non-zero-weight class has at
      least one evaluator).
- [ ] Internal window has been opened AND closed already.
- [ ] At least one super admin has a backup email/laptop.
- [ ] `SUPER_ADMIN_BOOTSTRAP_TOKEN` is rotated or removed from Convex env.
- [ ] Spec test: a sample external voter can sign in and reach `/vote`.

---

## Appendix: CSV import formats

### Candidates (`/admin/candidates` → "Import CSV")

| Column | Required | Notes |
| --- | --- | --- |
| `fullName` | yes | Also accepted: `Full Name`, `name`, `Name`. 2–120 characters. |
| `matric` | yes | Also accepted: `matricNumber`, `Matric`. 6–20 characters. Used for dedupe (case-insensitive). |
| `bio` | no | Up to 1000 characters. Empty allowed. |
| `positions` | no | `,` `;` or `\|`-separated list of position names. Names must match an existing position (case-insensitive). Position **order in the list = the candidate's preference order**, so the first one is their first choice. |

Header row is required. Duplicate `matric` values across the CSV (or already in the database) are skipped — not overwritten — and reported in the toast summary as "skipped".

A working sample lives at [docs/sample-candidates.csv](sample-candidates.csv). It uses the 15 candidates from the AGM 2025 selection sheet and lines up with the names produced by the **Seed default 9 positions** button on `/admin/positions`. Workflow:

1. `/admin/election` → create cycle.
2. `/admin/positions` → click "Seed default 9 positions".
3. `/admin/candidates` → "Import CSV" → pick `docs/sample-candidates.csv`.

### Internal whitelist (`/admin/whitelist` → "Upload CSV" / paste box)

| Column | Required | Notes |
| --- | --- | --- |
| `email` | yes | Also accepted: `Email`, `E-mail`, `e-mail`. Must end in `@student.usm.my`. |
| `voterClass` | no | Also accepted: `VoterClass`, `class`, `Class`, `role`, `Role`. Values: `topCommittee`, `headExecutive`, `year2Committee`, or human aliases like `top committee` / `head exec` / `year 2`. Rows without a class fall back to the "Default class" selector on the page. |

Paste-box mode treats any whitespace/comma-separated token as an email and uses the default class for every row. Anything that doesn't end in `@student.usm.my` lands in the "invalid" bucket of the import summary; duplicates that already exist in another class land in "reclassified"; exact duplicates land in "skipped".
