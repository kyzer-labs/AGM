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
- **Internal evaluator** — Year 2 committee member listed on the internal
  whitelist. Submits the rubric grid before AGM day.
- **External voter** — any other `@student.usm.my` student. Votes during
  the live AGM only.

---

## One-time setup (per cycle)

> All steps in this section happen on `/admin`.

1. **Create the cycle** at `/admin/election` → "Create".
2. **Add positions** at `/admin/positions`. The "Seed default 9 positions"
   button drops in the canonical CSS hierarchy. Reorder within each tier
   with the up/down arrows; ballot order on AGM day follows tier asc, then
   order asc.
3. **Add candidates** at `/admin/candidates`. Either add manually
   (with photo + bio) or upload a CSV with `fullName, matric, bio,
   positions` columns. The `positions` column accepts a `;`-separated list
   of position names; their order is the candidate's preference list.
4. **Import the Year 2 whitelist** at `/admin/whitelist`. Paste a list,
   upload a CSV, or add one at a time. Anyone NOT on this list votes
   externally on AGM day.
5. **Watch the readiness checklist** on `/admin/election`. The "Open
   internal" button only enables once positions, candidates, whitelist,
   and assignments are all green.

---

## ~1 week before AGM: internal evaluation window

1. **Open** the window from `/admin/election` ("Open internal").
2. **Notify** Year 2 evaluators. Their landing page is `/internal`.
3. **Monitor** completion at `/admin/internal`:
   - submitted vs draft vs not started
   - aggregate per-candidate averages across submitted evaluations only
4. **Close** the window from `/admin/election` once you have enough data
   to run AGM. Closing locks rubric scores forever.

> Late additions: you can still add evaluators to the whitelist while the
> window is open. The action is audited.

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
      computed immediately using the 75/25 rule.
   5. **If a tie is detected**, a manual resolver appears. Pick a winner,
      type a reason (>= 3 chars, recorded in the audit log), and resolve.
      The next ballot stays locked until you do.
4. After every ballot has a confirmed winner, move to **Results preview**
   from `/admin/election` (or the link on `/admin/results`).

---

## After voting: review and publish

1. Open `/admin/results` to inspect the per-position breakdown:
   internal share, public share, final % per candidate.
2. **Recompute** (super admin only) if you discover late corrections in
   internal scores or vote data. A reason is required.
3. **Publish** from `/admin/results` → "Publish all results".
   - Voters now see `/results`.
   - The cycle moves to `published` (terminal).

---

## Exports

`/admin/exports` provides the following downloads:

| File | Contents |
| --- | --- |
| `*-internal-scores.csv` | Per evaluator × candidate × rubric. Includes drafts. |
| `*-public-counts.csv` | Per position × candidate vote totals (no per-voter detail). |
| `*-combined-results.csv` | The 75/25 normalized table including winners. |
| `*-participation.csv` | Per voter snapshot (admin/internal/external + activity). |
| `*-audit-log.csv` | The privileged-action log (most recent 5,000 rows). |

---

## Emergency procedures (super admin)

### Tie that internal+final ladder cannot resolve
- Open `/admin/public` → the affected position's tie-resolver panel
- Pick a winner, write the reason, resolve. Audited.

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

### Recompute a single position's result
- `/admin/results` → "Recompute" (super admin only). Required only when
  evaluations or votes have been corrected after the ballot closed.

---

## Health checks before AGM day

- [ ] All admins listed at `/admin/admins` can log in.
- [ ] Setup readiness on `/admin/election` is green.
- [ ] Internal window has been opened AND closed already.
- [ ] At least one super admin has a backup email/laptop.
- [ ] `SUPER_ADMIN_BOOTSTRAP_TOKEN` is rotated or removed from Convex env.
- [ ] Spec test: a sample external voter can sign in and reach `/vote`.
