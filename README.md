# Nexa CRM

Nexa CRM is a Next.js App Router application backed by Supabase Auth and Postgres. Authenticated workspace members can work with persisted leads, contacts, companies, deals, tasks, activities, notes, tags, pipeline stages, and related attachments. The app also provides workspace reports, notifications, CSV import history, and saved views for leads, contacts, and companies. Access is workspace-scoped and enforced through server-side authorization and database row-level security (RLS).

## Requirements

- Node.js
- npm
- A Supabase project

## Setup

1. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to configure a fresh hosted Supabase project and apply every migration in filename order.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`. Use only the public anon key in the app; never add a service-role key.
3. Create the first user in the Supabase Auth dashboard, sign in at `/auth/sign-in`, and create the first workspace at `/onboarding`. The workspace creator becomes its initial admin.
4. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

Workspace admins create invitations from **Settings → Workspace access**. Invitees need a separately provisioned Supabase Auth account; see the [manual invitation workflow](./SUPABASE_SETUP.md#manual-invitation-workflow).

## Current capabilities and boundaries

CRM records and their supported changes are persisted in Supabase. Available areas include lead, contact, company, deal, and task management; user-created related activities and notes for leads, contacts, companies, and deals; attachments for contacts and companies plus deal attachments; system activity timelines on lead and deal details; pipeline and tag settings; reports; notifications; CSV import with job history; and saved views for leads, contacts, and companies. Exact actions are subject to workspace role and record permissions. Attachments use private Supabase Storage buckets and database-backed access policies.

Nexa CRM does not send invitation emails or create Auth accounts; admins must share each one-time link with the intended person through a trusted channel.

The demo seed is exclusively for disposable local/test databases. Never run `supabase/seed.sql` or `supabase db reset` against a hosted project. See [`supabase/DEMO_SEED.md`](supabase/DEMO_SEED.md) for the local-only workflow.

## Available checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:auth
```

See [`TESTING.md`](TESTING.md) for how to run each check, including local Supabase setup for the authenticated E2E suite and CI guidance.
