# USM CSS AGM Election Portal

Web app for the **USM Computer Science Society Annual General Meeting** election:
internal Year-2 rubric evaluation before AGM day, live AGM-day public voting, and a
published result that combines both components using the election cycle's configured
weighting.

## Stack

- **Bun** runtime
- **Next.js 15** (App Router, React 19, TypeScript strict)
- **Tailwind v4** with custom design tokens
- **Convex** (database, queries/mutations, file storage, real-time)
- **Firebase Auth** with Microsoft OAuth for USM student email sign-in

## Documents

- Spec & user stories — [docs/AGM_USER_STORIES.md](docs/AGM_USER_STORIES.md)
- **Setup guide (start here)** — [docs/SETUP.md](docs/SETUP.md)
- **Operations runbook (during AGM)** — [docs/RUNBOOK.md](docs/RUNBOOK.md)
- **Testing playbook (dev seeder + 2-account smoke test)** — [docs/TESTING.md](docs/TESTING.md)

## Status

All seven implementation phases are complete:

| Phase | Surface |
| --- | --- |
| 0 | Bootstrap (Bun, Next.js, Tailwind, design tokens) |
| 1 | Identity & profile (Microsoft OAuth, USM domain lock, voter profile) |
| 2 | Admin allowlist + super-admin bootstrap |
| 3 | Election cycle, positions, candidates (with photo upload), Year-2 whitelist (CSV import) |
| 4 | Internal rubric evaluation (5 categories × N candidates), draft + submit, admin completion + aggregate dashboards |
| 5 | Live AGM voting (per-position session machine, cascade rules, manual tie resolution) |
| 6 | Weighted results preview, super-admin recompute, public results page |
| 7 | CSV exports, audit log download, super-admin emergency voter audit |

Every privileged mutation is audited. UI is hand-rolled shadcn-style on
Tailwind v4. The whole frontend is reactive via Convex's `useQuery`.

Result weighting is configured per AGM cycle. Do not hardcode a fixed split in
new result displays or calculations.

## Quickstart

See [docs/SETUP.md](docs/SETUP.md) for the full Firebase + Convex setup.

```bash
bun install
# follow docs/SETUP.md to create the Firebase project, enable Microsoft auth,
# create the Convex project, and fill in .env.local
bunx convex dev   # terminal 1
bun dev           # terminal 2
```
