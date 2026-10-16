# Testing

This project has three layers of automated checks: static checks, unit/integration tests (Vitest), and end-to-end tests (Playwright, driven through Node's built-in test runner). This document covers all of them, with a focus on running the E2E suites locally and in CI.

## Quick reference

```sh
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest unit/integration tests (~1100 tests, no external services)
npm run build         # Next.js production build
npm run test:e2e      # Unauthenticated E2E (no Supabase project needed)
npm run test:e2e:auth # Authenticated E2E (requires a local Supabase stack)
```

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before every commit. The two E2E scripts need the setup described below.

## Unauthenticated E2E (`npm run test:e2e`)

File: `tests/e2e/unauthenticated-workspace.test.mjs`.

This suite starts its own disposable `next dev` server with **empty** Supabase environment variables and asserts that:

- Protected `/app/*` routes show a "Supabase setup required" notice instead of any dashboard content.
- Public `/demo/*` routes render their fictional, read-only content without any Supabase configuration.

No Supabase project, Docker, or seed data is required. It does **not** read your local `.env.local`; it spawns the dev server with its own explicit (empty) environment. However, Next.js loads `.env.local` with **higher precedence** than variables passed to the spawned process. If your working copy has a `.env.local` with real `NEXT_PUBLIC_SUPABASE_*` values (as it will for local development against a project), this suite will fail locally because the spawned server picks up your real config instead of the test's empty one. This does not affect CI, where no `.env.local` file exists. To run this suite locally, temporarily rename `.env.local` out of the way, or run it from a checkout without that file.

## Authenticated E2E (`npm run test:e2e:auth`)

Files:

- `tests/e2e/authenticated-leads.test.mjs` — permission checks via a programmatic (no-browser) SSR session.
- `tests/e2e/authenticated-flows.test.mjs` — broad CRM UI journey (search/filter, company/contact/activity/task creation, lead conversion, deal stage/outcome changes, CSV import, RLS-denied viewer writes), unauthenticated redirects, deactivated-member access, admin-only user administration, and cross-tenant isolation.
- `tests/e2e/authenticated-critical-flows.test.mjs` — the three MVP-critical journeys:
  1. Sign in → create a lead → open its detail page → add a follow-up task from the lead → mark it complete from the Tasks page → verify the lead detail page reflects the completed task.
  2. Create a lead → convert it (the app's only lead-conversion action, which provisions a linked contact and company as part of the same step) → verify the resulting contact/company/deal are linked → create a second, independent deal from that same company and contact through the normal "Add Deal" form.
  3. Find a lead through the global "Search CRM" command palette → apply the "Filter by tag" filter on the Leads list and verify it narrows results → open the lead detail page and confirm its activity timeline loads → run the bulk "Add tag" action (the only multi-record bulk action the UI currently offers; there is no bulk archive yet) on selected leads.
- `tests/e2e/authenticated-search-order.test.mjs` — global search ordering (newest-first, id-tie-broken, top 5 per type).
- `tests/e2e/authenticated-invitations.test.mjs` — invitation creation, mismatched-identity rejection, single-use acceptance, and revocation.

All of these use real Playwright (`chromium.launch`) or an SSR session against a **local, disposable** Supabase stack — never a hosted or production project.

### Prerequisites

- Docker Desktop running.
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) available via `npx supabase` (no separate install needed; `npx` fetches it on first use).
- Project dependencies installed (`npm install`).
- Playwright's Chromium browser installed once per environment: `npx playwright install chromium`.

### Start and seed the local stack

```sh
npx supabase start   # first run applies migrations + supabase/seed.sql
npx supabase db reset  # re-apply migrations + seed to get back to a clean, known state
```

See [`supabase/DEMO_SEED.md`](supabase/DEMO_SEED.md) for full details, including the five seeded demo identities and the hard rule that this seed must never be run against a hosted/shared/production project.

### Run the suite

```sh
npm run test:e2e:auth
```

This requires no manually exported environment variables and no running `npm run dev` server: each test reads the local Supabase CLI status in memory (`npx supabase status -o env`), verifies the API URL is loopback, provisions the seeded demo users with a fresh per-run password via the local Auth admin API, and starts its own disposable `next dev` server on an ephemeral port. Tests run with `--test-concurrency=1` because they share the same fixed seeded workspace and users.

Each authenticated test creates uniquely named, disposable records (leads, contacts, companies, deals, tasks, tags) through the real UI and removes them in a `finally` block, so the suite is safe to re-run repeatedly against the same seeded database without a reset in between. If a run is interrupted before cleanup finishes, re-running `npx supabase db reset` restores a clean baseline.

### Running a single file

```sh
node --test --test-concurrency=1 tests/e2e/authenticated-critical-flows.test.mjs
```

## CI

There is currently no CI workflow file in this repository (no `.github/workflows/`). When adding one, run the checks in this order so faster checks fail first:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:auth
```

Requirements for `test:e2e:auth` in CI:

- A Docker-capable runner (e.g. GitHub's `ubuntu-latest`) to run `npx supabase start`.
- No `.env.local` file in the checkout — CI runners do not create one, so the unauthenticated suite's "Supabase setup required" assertions hold correctly.
- Install Playwright's Chromium once per job: `npx playwright install --with-deps chromium`.
- Start and seed the local stack before running the authenticated suite:

  ```sh
  npx supabase start
  npm run test:e2e:auth
  ```

- No secrets need to be configured for E2E: the local Supabase stack generates its own local-only anon/service-role keys, and the tests never persist them to disk.
