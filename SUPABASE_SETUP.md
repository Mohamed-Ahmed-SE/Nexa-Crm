# Supabase setup — Phase 1

Phase 1 uses Supabase Auth and Postgres through the public anon key and per-user sessions. Never add a service-role key to this app, `.env.example`, or browser code. The service-role key bypasses RLS and is not needed for this phase.

## Connect a Supabase project

1. Create a Supabase project and keep its database password and dashboard credentials out of this repository.
2. In **Project Settings → API**, copy the Project URL and public anon key (sometimes labelled `anon` or `publishable`). Do not use a `service_role` or secret key.
3. Copy `.env.example` to `.env.local`, replace the two Supabase placeholders, and set `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local development. For deployment, set it to the exact HTTPS app origin. Restart the Next.js process after changing environment values.
4. In **Authentication → URL Configuration**, set the Site URL to that same app origin and add `<site-origin>/auth/callback` to the redirect URL allow list (for local development: `http://localhost:3000/auth/callback`). Enable the Email provider and password sign-in. Configure email delivery and password/security settings in Supabase if recipients will use password-reset flows.
5. In **SQL Editor**, run [`supabase/migrations/202604030001_phase1_auth_workspace.sql`](supabase/migrations/202604030001_phase1_auth_workspace.sql), [`supabase/migrations/202604030002_workspace_invitations.sql`](supabase/migrations/202604030002_workspace_invitations.sql), and [`supabase/migrations/202604030003_workspace_member_column_permissions.sql`](supabase/migrations/202604030003_workspace_member_column_permissions.sql) in filename order, using the project owner SQL editor. Review each migration before applying it to any non-development database.
6. Create the first user through the Supabase Auth dashboard. Sign in at `/auth/sign-in`; the first authenticated user without an active workspace can create one at `/onboarding`. The database creates that user as the initial `admin` atomically and associates the optional job title with their profile.
7. Run `npm run dev` and verify the configured app. Keep `.env.local` untracked; `.env.example` contains placeholders only.

The migrations create `profiles`, `workspaces`, `workspace_members`, and `workspace_invites`, profile creation on Auth user creation, workspace bootstrap, hashed one-time invitation tokens, admin-only access RPCs, indexes/constraints, admin safeguards, and RLS policies. Invite acceptance is bound to the authenticated user's `auth.users.email`, workspace, pending state, and expiration, and is performed in one database transaction. The invite listing RPC omits token hashes; authenticated users have no direct grants on the invitation table.

## Manual invitation workflow

This app does not send invitation email, create Supabase Auth accounts, or provide public signup. Workspace admins must provision each recipient's account before sending them a link:

1. In the Supabase dashboard, open **Authentication → Users** and create a user for the recipient's exact email address. Provision the initial sign-in credentials through the dashboard or your established account-provisioning process, then share those credentials securely with the recipient.
2. Sign in to Nexa CRM as a workspace admin. Open **Settings → Workspace access**, enter the same email, choose a role, and create the invitation. Copy the generated URL immediately: its raw token is shown only once and is not stored in the database.
3. Share the link with the intended person through a trusted channel. The recipient signs in to Nexa CRM with the provisioned account using the matching email and accepts the invitation. If they are signed in to a different account, they can sign out from the acceptance page and sign in with the invited account.

Invitation links expire after seven days, can be accepted once, and are invalidated when an admin revokes them. The workspace is joined only after the signed-in user's email matches the invitation. An expired, revoked, mismatched, or previously accepted link cannot add a member. Revoke an expired pending invitation before creating a replacement for the same email. Email delivery, password resets, and initial credentials remain outside Nexa CRM and depend on the administrator's Supabase/account-provisioning setup.

The UI/server does not use a client-provided user id, workspace id, or role as authority. Server context reads the verified Auth user and their active database membership; SQL functions check the authenticated identity and admin membership, RLS restricts row access, and authenticated users can update only the `role` and `status` columns of workspace memberships.

## Seed/configuration scope and limits

Phase 1 has no CRM business tables or demo business-data seeding. The first-user workflow is the workspace seed: authenticated user profile, one workspace, and one active Admin membership in a single transaction. Do not seed real customer data into this auth migration.

If configuration is missing or malformed, protected workspace routes show a setup notice and do not render the shell or route content. Local HTTP is allowed only for localhost. Password reset links require the configured site origin to be allow-listed in Supabase.
