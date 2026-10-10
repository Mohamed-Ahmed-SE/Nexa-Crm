# Local Supabase demo data

This workflow is only for a disposable local Supabase stack or an isolated test database. **Never run `seed.sql` or `supabase db reset` against a hosted, shared, or production project.** Do not link the CLI to a hosted project. Never copy the service-role key into app configuration or `.env.local`, print it, or use it against hosted or shared services. Only the authenticated E2E test temporarily reads the key in memory, after validating that the Auth API URL is loopback, to provision users on the local stack.

## Prerequisites

- Docker Desktop running.
- Supabase CLI installed and available as `supabase` (see the [Supabase CLI installation guide](https://supabase.com/docs/guides/local-development/cli/getting-started)).
- Node.js and the project dependencies installed.
- Playwright's Chromium browser installed. From the repository root, run `npx playwright install chromium` once per environment and again after upgrading Playwright.

## Start and seed the local database

From the repository root, start the local stack:

```sh
supabase start
```

On first startup, the CLI applies the migrations in `supabase/migrations/` and then runs the configured `supabase/seed.sql`. The seed creates the five demo Auth identities and repeatable CRM data, but leaves their passwords unset. To rebuild the disposable local database and restore the demo dataset later, use `supabase db reset`. It drops and recreates that local database before reapplying migrations and the seed; do not use it when you need to preserve local data. Existing hosted setup remains the manual SQL Editor workflow described in [`SUPABASE_SETUP.md`](../SUPABASE_SETUP.md); this seed is not part of that workflow.

## Point the app at local Supabase

After local Supabase is running, display only the local API URL and public anon key:

```sh
supabase status -o env | awk -F= '$1 == "API_URL" || $1 == "ANON_KEY" {print}'
```

Set `NEXT_PUBLIC_SUPABASE_URL` to `API_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `ANON_KEY` in your local `.env.local`; keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Use only the local URL and public anon key. Never put `SERVICE_ROLE_KEY` in `.env.local` or use it from the app; its only permitted use is in memory by the authenticated local E2E test after loopback validation. Restart the app after changing environment values:

```sh
npm run dev
```

The app continues to use its normal authenticated client and RLS. The seed itself runs as part of the local database reset and does not add a service-role key to the application.

## Local authenticated E2E

Run `npm run test:e2e:auth` against a running disposable local Supabase stack after installing the project dependencies and Playwright Chromium as described above. The test reads the local CLI status in memory, verifies that `API_URL` is loopback before making Auth requests, and uses the local Auth admin API to set a newly generated, per-run password on the seeded demo users. The password and service-role key are never printed or written to files. It starts its own loopback Next.js dev server, then exercises manager lead search/filtering, company/contact/activity/task creation, lead conversion, deal stage and outcome changes, CSV import, and viewer write denial. No separate `npm run dev` or shared demo password is needed; local users can be reprovisioned by rerunning the test. Cleanup removes the uniquely named CRM records and their activities, but leaves the import-history row because the schema has no per-run identifier that can safely distinguish it from a concurrent local import.

| Role | Name | Local/test email |
| --- | --- | --- |
| Admin | Avery Stone | `avery.stone@northstar-demo.example` |
| Manager | Maya Hassan | `maya.hassan@northstar-demo.example` |
| Member | Omar Nabil | `omar.nabil@northstar-demo.example` |
| Member | Lina Kareem | `lina.kareem@northstar-demo.example` |
| Viewer | Sam Reed | `sam.reed@northstar-demo.example` |

These are disposable local demo identities, not real accounts. Never create them or use this seed on a hosted project.

## Seeded saved views

Each of the five Northstar demo users has private “New leads” and “Qualified leads” saved views.

## Reset

To discard the local database and restore migrations plus the demo dataset, run `supabase db reset` again. To stop the local services without resetting data, run `supabase stop`.

The seed creates records only for tables implemented by the current migrations, including `crm_import_jobs` and `notifications`. It does not create attachments or storage objects. The app's regular hosted-project migration instructions are unchanged; hosted and production databases must never use this seed.
