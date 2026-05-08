# USM CSS AGM Election Portal

Web app for the **USM Computer Science Society Annual General Meeting** election:
internal Year-2 rubric evaluation before AGM day, live AGM-day public voting, and a
75/25 combined result with publishing.

## Stack

- **Bun** runtime
- **Next.js 15** (App Router, React 19, TypeScript strict)
- **Tailwind v4** with custom design tokens
- **Convex** (database, queries/mutations, file storage, real-time)
- **Firebase Auth** with Microsoft OAuth (so `@student.usm.my` Outlook accounts work)

## Documents

- Spec & user stories — [docs/AGM_USER_STORIES.md](docs/AGM_USER_STORIES.md)
- **Setup guide (start here)** — [docs/SETUP.md](docs/SETUP.md)

## Status

Phase 0–2 of the implementation plan are scaffolded:

- USM-domain-locked Microsoft sign-in via Firebase Auth.
- Firebase ID token verified by Convex (`convex/auth.config.ts`).
- `voters` profile flow with server-validated full name, matric, year of study.
- `admins` allowlist with one-time super-admin bootstrap.
- `auditLog` populated by every privileged mutation.
- Landing page, dashboard, profile, admin console with bootstrap card.
- Schema for elections, positions, candidates, whitelist, evaluations, scores,
  votes, results — ready for Phases 3–6.

## Quickstart

See [docs/SETUP.md](docs/SETUP.md) for the full Firebase + Convex setup.

```bash
bun install
# follow docs/SETUP.md to create the Firebase project, enable Microsoft auth,
# create the Convex project, and fill in .env.local
bunx convex dev   # terminal 1
bun dev           # terminal 2
```
