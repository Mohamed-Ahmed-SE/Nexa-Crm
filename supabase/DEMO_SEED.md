# Local Supabase demo data

This workflow is only for a disposable local Supabase stack or an isolated test database. **Never run `seed.sql` or `supabase db reset` against a hosted, shared, or production project.** Do not link the CLI to a hosted project. Keep service-role credentials out of the app, `.env.local`, and this workflow.

## Prerequisites

- Docker Desktop running.
- Supabase CLI installed and available as `supabase` (see the [Supabase CLI installation guide](https://supabase.com/docs/guides/local-development/cli/getting-started)).
- Node.js and the project dependencies installed.

## Start and seed the local database

From the repository root, start the local stack:

```sh
supabase start
```

On first startup, the CLI applies the migrations in `supabase/migrations/` and then runs the configured `supabase/seed.sql`. To rebuild the disposable local database and restore the demo dataset later, use `supabase db reset`. It drops and recreates that local database before reapplying migrations and the seed; do not use it when you need to preserve local data. Existing hosted setup remains the manual SQL Editor workflow described in [`SUPABASE_SETUP.md`](../SUPABASE_SETUP.md); this seed is not part of that workflow.

## Point the app at local Supabase

After local Supabase is running, display only the local API URL and public anon key:

```sh
supabase status -o env | awk -F= '$1 == "API_URL" || $1 == "ANON_KEY" {print}'
```

Set `NEXT_PUBLIC_SUPABASE_URL` to `API_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `ANON_KEY` in your local `.env.local`; keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Use only the local URL and public anon key. Do not copy or use `SERVICE_ROLE_KEY`. Restart the app after changing environment values:

```sh
npm run dev
```

The app continues to use its normal authenticated client and RLS. The seed itself runs as part of the local database reset and does not add a service-role key to the application.

## Local-only demo sign-in

All five seeded Auth users are local/test-only and have no shared password. Use the authenticated E2E suite to provision ephemeral credentials.

| Role | Name | Local/test email |
| --- | --- | --- |
| Admin | Avery Stone | `avery.stone@northstar-demo.example` |
| Manager | Maya Hassan | `maya.hassan@northstar-demo.example` |
| Member | Omar Nabil | `omar.nabil@northstar-demo.example` |
| Member | Lina Kareem | `lina.kareem@northstar-demo.example` |
| Viewer | Sam Reed | `sam.reed@northstar-demo.example` |

These are disposable demo credentials, not real accounts. They are created only in the local Auth database. Never create these users or reuse this password on a hosted project.

## Seeded saved views

Each of the five Northstar demo users has private “New leads” and “Qualified leads” saved views.

## Reset

To discard the local database and restore migrations plus the demo dataset, run `supabase db reset` again. To stop the local services without resetting data, run `supabase stop`.

The seed creates records only for tables implemented by the current migrations, including `crm_import_jobs` and `notifications`. It does not create attachments or storage objects. The app's regular hosted-project migration instructions are unchanged; hosted and production databases must never use this seed.
