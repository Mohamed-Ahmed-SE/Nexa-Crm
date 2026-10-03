# Nexa CRM

A runnable Next.js App Router foundation for Nexa CRM with Supabase authentication, workspace membership, and admin-managed access.

## Requirements

- Node.js
- npm
- A Supabase project

## Setup

1. Copy `.env.example` to `.env.local` and configure the public Supabase URL, anon key, and app site URL. Never add a service-role key.
2. Run the SQL migrations in `supabase/migrations/` in filename order in the Supabase SQL Editor.
3. Create the first user through Supabase Authentication. Sign in at `/auth/sign-in`; the first authenticated user can create a workspace at `/onboarding` and becomes its admin.
4. Run `npm install` and `npm run dev`, then open [http://localhost:3000](http://localhost:3000).

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed configuration, the manual no-mail invitation workflow, and its account provisioning requirements.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope

Supabase stores authentication, workspace membership, and invitations. Workspace admins can list members, change member roles or status, and create, revoke, and accept seven-day invitation links. There is no app email delivery or public account signup: admins provision each recipient's Supabase Auth account separately, then share the one-time invitation link with them. Recipients must sign in using the invited email address before accepting.

The CRM dashboard and business modules are still a foundation prototype. CRM records, metrics, search, notifications, reports, and business-data mutations are not persisted in Supabase yet.
