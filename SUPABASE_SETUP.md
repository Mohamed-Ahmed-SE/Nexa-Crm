# Supabase setup

These instructions describe a **fresh hosted Supabase project**. The app uses the public anon key and the signed-in user's session; database access is scoped by workspace authorization and RLS. Never put a service-role or secret key in app configuration, `.env.example`, `.env.local`, or browser code. The app does not need that key.

## Configure a fresh hosted project

1. Create a new Supabase project. Keep its database password and dashboard credentials out of this repository.
2. In **Project Settings → API**, copy the Project URL and public anon key (sometimes labelled `anon` or `publishable`). Do not use a `service_role` or secret key.
3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` to the Project URL, `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the public anon key, and `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local development. For deployment, use the exact HTTPS origin of the app. Restart the Next.js process after changing environment values.
4. In **Authentication → URL Configuration**, set the Site URL to the same app origin and add `<site-origin>/auth/callback` to the redirect URL allow list (for local development: `http://localhost:3000/auth/callback`). Enable the Email provider and password sign-in. Configure Supabase email delivery and password/security settings if users need password-reset flows.
5. In the new project's **SQL Editor**, apply every migration below, one file at a time and in the listed filename order. Use the project's SQL Editor with an appropriately privileged project-owner account. Review the SQL before applying it, and confirm each file completes successfully before proceeding to the next. Stop on any error; investigate it before continuing. Do not skip files or rerun a file that has already successfully completed.

   1. [`202604030001_phase1_auth_workspace.sql`](supabase/migrations/202604030001_phase1_auth_workspace.sql)
   2. [`202604030002_workspace_invitations.sql`](supabase/migrations/202604030002_workspace_invitations.sql)
   3. [`202604030003_workspace_member_column_permissions.sql`](supabase/migrations/202604030003_workspace_member_column_permissions.sql)
   4. [`202604030004_crm_core.sql`](supabase/migrations/202604030004_crm_core.sql)
   5. [`202604030005_workspace_lead_owner_lookup.sql`](supabase/migrations/202604030005_workspace_lead_owner_lookup.sql)
   6. [`202604030006_contact_engagement.sql`](supabase/migrations/202604030006_contact_engagement.sql)
   7. [`202604030007_company_engagement.sql`](supabase/migrations/202604030007_company_engagement.sql)
   8. [`202604030008_member_unlinked_tasks.sql`](supabase/migrations/202604030008_member_unlinked_tasks.sql)
   9. [`202604030009_workspace_reports.sql`](supabase/migrations/202604030009_workspace_reports.sql)
   10. [`202604030010_notifications.sql`](supabase/migrations/202604030010_notifications.sql)
   11. [`202604030011_member_deal_outcome_access.sql`](supabase/migrations/202604030011_member_deal_outcome_access.sql)
   12. [`202604030012_crm_import_jobs.sql`](supabase/migrations/202604030012_crm_import_jobs.sql)
   13. [`202604030013_saved_views.sql`](supabase/migrations/202604030013_saved_views.sql)
   14. [`202604030014_lead_conversion.sql`](supabase/migrations/202604030014_lead_conversion.sql)
   15. [`202604030015_profile_date_format.sql`](supabase/migrations/202604030015_profile_date_format.sql)
   16. [`202604030016_pipeline_stage_settings.sql`](supabase/migrations/202604030016_pipeline_stage_settings.sql)
   17. [`202604030017_create_pipeline_stage.sql`](supabase/migrations/202604030017_create_pipeline_stage.sql)
   18. [`202604030018_deactivate_pipeline_stage.sql`](supabase/migrations/202604030018_deactivate_pipeline_stage.sql)
   19. [`202604030019_member_lead_activity.sql`](supabase/migrations/202604030019_member_lead_activity.sql)
   20. [`202604030020_member_company_task_activity.sql`](supabase/migrations/202604030020_member_company_task_activity.sql)
   21. [`202604030021_contacts_saved_views.sql`](supabase/migrations/202604030021_contacts_saved_views.sql)
   22. [`202604030022_workspace_report_completion.sql`](supabase/migrations/202604030022_workspace_report_completion.sql)
   23. [`202604030023_member_lead_engagement.sql`](supabase/migrations/202604030023_member_lead_engagement.sql)
   24. [`202604030024_member_deal_engagement.sql`](supabase/migrations/202604030024_member_deal_engagement.sql)
   25. [`202604030025_member_deal_note_updates.sql`](supabase/migrations/202604030025_member_deal_note_updates.sql)
   26. [`202604030026_onboarding_pipeline_templates.sql`](supabase/migrations/202604030026_onboarding_pipeline_templates.sql)
   27. [`202604030027_task_reminders.sql`](supabase/migrations/202604030027_task_reminders.sql)
   28. [`202604030028_engagement_target_validation.sql`](supabase/migrations/202604030028_engagement_target_validation.sql)
   29. [`202604030029_companies_saved_views.sql`](supabase/migrations/202604030029_companies_saved_views.sql)
   30. [`202604030030_active_lead_engagement_policies.sql`](supabase/migrations/202604030030_active_lead_engagement_policies.sql)
   31. [`202604030031_inactive_owner_status_lookup.sql`](supabase/migrations/202604030031_inactive_owner_status_lookup.sql)
   32. [`202604030032_deal_attachments.sql`](supabase/migrations/202604030032_deal_attachments.sql)
   33. [`202604030033_lead_conversion_stage_activity.sql`](supabase/migrations/202604030033_lead_conversion_stage_activity.sql)
   34. [`202604030034_report_and_active_lead_policy_reconciliation.sql`](supabase/migrations/202604030034_report_and_active_lead_policy_reconciliation.sql)
   35. [`202604030035_report_and_active_lead_policy_reconciliation.sql`](supabase/migrations/202604030035_report_and_active_lead_policy_reconciliation.sql)
   36. [`202604030036_report_activity_classification.sql`](supabase/migrations/202604030036_report_activity_classification.sql)

   These are schema migrations, not demo-data scripts. Keep a record of which files were successfully applied. If setting up a project that already has some Nexa migrations, do not blindly run this full fresh-project list: reconcile the database with its migration/deployment records, then apply only confirmed unapplied files in filename order. Do not rerun already-applied migrations.
6. After all migrations have completed, create the first user in the Supabase dashboard under **Authentication → Users**. Sign in at `/auth/sign-in`; that authenticated user can create the first workspace at `/onboarding` and becomes its initial admin. The profile and active membership are created by the database workflow.
7. Run `npm install` and `npm run dev` and verify the configured app. Keep `.env.local` untracked; `.env.example` contains placeholders only.

Never use `supabase db reset` or run `supabase/seed.sql` against a hosted, shared, or production project. They are destructive/local-test data operations, not deployment or migration methods. For the permitted disposable local workflow, read [`supabase/DEMO_SEED.md`](supabase/DEMO_SEED.md).

## What the migrations provide

The migrations establish Auth profiles and workspace membership/invitations, role- and workspace-scoped RLS, CRM records (leads, contacts, companies, deals, pipeline configuration, and tags), engagement records (activities, tasks, notes, and attachments, including deal attachments), private attachment storage policies, reports, notifications, import-job history, lead conversion, and user-specific saved views for leads, contacts, and companies. Later migrations refine access and add features; applying only the first three migrations leaves out most of the current CRM schema and app functionality.

The app uses the authenticated user's verified Supabase session for requests. Server-side workspace context and SQL authorization derive identity, workspace membership, and role from the session/database—not client-provided IDs or roles. RLS policies constrain database access. Keep the service-role key out of the app; its RLS bypass is not an acceptable substitute for user-scoped access.

## Manual invitation workflow

Nexa CRM does not send invitation email, create Supabase Auth accounts for invitees, or provide public signup. An admin must provision each recipient's Auth account before creating and sharing an invite:

1. In the Supabase dashboard, open **Authentication → Users** and create a user for the recipient's exact email address. Provision initial sign-in credentials through the dashboard or your established account-provisioning process, then share those credentials securely with the recipient.
2. Sign in to Nexa CRM as a workspace admin. Open **Settings → Workspace access**, enter the same email, choose a role, and create the invitation. Copy the generated URL immediately: its raw token is shown only once and is not stored in the database.
3. Share the link with the intended person through a trusted channel. The recipient signs in with the provisioned account using the matching email and accepts the invitation. If they are signed in to a different account, they can sign out from the acceptance page and sign in with the invited account.

Invitation links expire after seven days, can be accepted once, and are invalidated when an admin revokes them. Acceptance requires the signed-in user's email to match the invitation. An expired, revoked, mismatched, or previously accepted link cannot add a member. Revoke an expired pending invitation before creating a replacement for the same email. Email delivery, password resets, and initial credentials remain outside Nexa CRM and depend on the administrator's Supabase/account-provisioning setup.

## Configuration notes

If configuration is missing or malformed, protected workspace routes show a setup notice rather than rendering protected content. The app requires HTTPS for non-local Supabase and site origins; HTTP is allowed only for localhost/127.0.0.1. Password-reset links require the configured site origin to be allow-listed in Supabase.
