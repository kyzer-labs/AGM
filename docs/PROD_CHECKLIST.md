# Production Checklist

Use this before wiring the org repository to a production or development deployment pipeline.

## Repository hygiene

- [ ] Confirm no local build outputs, logs, `.env*`, `.next`, `node_modules`, or agent tooling folders are tracked.
- [ ] Keep real election spreadsheets, student lists, candidate lists, and marking sheets out of git. Use sanitized CSV samples only.
- [ ] Confirm `.env.example` documents every required variable without real values.
- [ ] Run `git status --short` and make sure only intentional source/doc changes are present.

## Environment separation

- [ ] Create separate Firebase projects for development/staging and production, or clearly separate their web apps and OAuth settings.
- [ ] Create separate Convex deployments for development/staging and production.
- [ ] Set `NEXT_PUBLIC_CONVEX_URL` to the matching Convex deployment for each hosting environment.
- [ ] Set `FIREBASE_PROJECT_ID` in each Convex deployment to the Firebase project that issues tokens for that environment.
- [ ] Add the production domain to Firebase Authentication authorized domains.
- [ ] Set `NEXT_PUBLIC_MICROSOFT_TENANT` to the intended tenant policy for production.

## Secrets and safety gates

- [ ] Generate a fresh `SUPER_ADMIN_BOOTSTRAP_TOKEN` for production.
- [ ] Bootstrap the first super admin, then rotate or unset `SUPER_ADMIN_BOOTSTRAP_TOKEN` in the production Convex deployment.
- [ ] Leave `DEV_SEED_ALLOWED` unset in production.
- [ ] Verify `/admin/dev` shows the disabled seeder state in production.
- [ ] Confirm emergency voter audit access is restricted to super admins.

## Verification

- [ ] Install dependencies with `bun install`.
- [ ] Run `bun run verify`.
- [ ] If checking steps manually, run them in this order: `bun run lint`, `bun run build`, then `bun run typecheck`.
- [ ] Run the dev seeder flow only on the development Convex deployment.
- [ ] Complete the two-account smoke test in `docs/TESTING.md` before the real AGM cycle.

## Release readiness

- [ ] Confirm every admin can sign in with Microsoft and reach `/admin`.
- [ ] Confirm at least one backup super admin account exists.
- [ ] Confirm the public landing page, profile completion, `/vote`, `/internal`, `/results`, and all `/admin/*` pages load against the target deployment.
- [ ] Confirm candidate photos load from Convex storage or approved photo URLs.
- [ ] Export and store a test audit log from `/admin/exports`.
- [ ] Keep `docs/RUNBOOK.md` open during the AGM event.
