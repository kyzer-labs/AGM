# USM CSS AGM Election Portal

Production web app for running the **USM Computer Science Society Annual General
Meeting election**.

The portal supports the full election cycle: Microsoft-authenticated voter
access, candidate and position setup, Year-2 internal rubric evaluation, live AGM
public voting, weighted result calculation, publishing, exports, and audited
admin operations.

## What this repo contains

- **Public and authenticated voter flows** for sign-in, profile completion,
  live voting, standby states, and published results.
- **Internal evaluator flow** for Year-2 rubric scoring across the configured
  candidate slate.
- **Admin console** for election cycles, positions, candidates, internal
  whitelist management, live ballot operations, result preview/publishing,
  exports, audit access, and super-admin access control.
- **Convex backend** for data models, queries, mutations, audit logging, result
  computation, storage-backed candidate photos, and development fixtures.
- **Operational docs** for local setup, testing, AGM-day operation, and
  production deployment readiness.

## Stack

- **Bun** runtime
- **Next.js 15** App Router with React 19 and strict TypeScript
- **Tailwind CSS v4** with project-specific design tokens
- **Convex** for database, backend functions, file storage, and real-time data
- **Firebase Auth** with Microsoft OAuth for USM student email sign-in

## Repository map

```text
app/          Next.js routes, layouts, providers, and API routes
components/   Shared UI, auth, admin, landing, dialog, and voting components
convex/       Backend schema, queries, mutations, auth config, and audit logic
lib/          Client utilities, formatting, Firebase, CSV, weights, and tests
docs/         Setup, runbook, testing guide, production checklist, user stories
public/       Static assets used by the app
scripts/      Small one-off utility scripts
```

## Core election model

The app combines two separately normalised result sources:

- **Internal evaluation**: whitelisted Year-2 evaluators score active candidates
  with a configured rubric.
- **Public voting**: eligible AGM voters cast one live ballot per active
  position during the public voting phase.

The final weighting is configured per election cycle. Do not hardcode a fixed
split in new result displays or calculations.

Privileged mutations are audited, and super-admin-only surfaces are intentionally
kept separate from normal operator flows.

## Documentation

- [Setup guide](docs/SETUP.md) - Firebase, Convex, environment variables, and
  first super-admin bootstrap.
- [Operations runbook](docs/RUNBOOK.md) - step-by-step AGM-day operation.
- [Testing playbook](docs/TESTING.md) - fixture seeding and smoke-test flows.
- [Production checklist](docs/PROD_CHECKLIST.md) - repository, environment, and
  release-readiness checks before deployment.
- [User stories](docs/AGM_USER_STORIES.md) - product behavior and role coverage.

## Local development

Install dependencies:

```bash
bun install
```

Follow [docs/SETUP.md](docs/SETUP.md) to create and configure Firebase and
Convex, then run the backend and frontend in separate terminals:

```bash
bunx convex dev
bun dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

## Verification

Before opening a pull request or deploying, run:

```bash
bun run verify
```

This runs linting, a production build, and TypeScript checking. If running the
steps manually, use the same order:

```bash
bun run lint
bun run build
bun run typecheck
```

## Deployment notes

Use separate Firebase projects or app registrations and separate Convex
deployments for development/staging and production. Production should have its
own `NEXT_PUBLIC_CONVEX_URL`, Firebase authorized domain, Convex
`FIREBASE_PROJECT_ID`, and freshly generated `SUPER_ADMIN_BOOTSTRAP_TOKEN`.

Keep `DEV_SEED_ALLOWED` unset in production. The `/admin/dev` fixture tools are
for development and controlled smoke testing only.
