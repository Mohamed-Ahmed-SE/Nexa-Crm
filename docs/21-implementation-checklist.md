# 21 — Implementation Checklist

Codex should keep this as a working checklist.

## Foundation
- [ ] Next.js app bootstrapped
- [ ] TypeScript strict enough for production
- [ ] Tailwind configured
- [ ] shadcn/ui or equivalent primitives
- [ ] lint
- [ ] typecheck
- [ ] Vitest
- [ ] Playwright
- [ ] Supabase clients
- [ ] env validation
- [ ] application shell matches visual references

## Auth / Workspace
- [ ] sign in
- [ ] password reset
- [ ] onboarding
- [ ] workspace
- [ ] memberships
- [ ] roles
- [ ] invites
- [ ] RLS

## Leads
- [ ] list
- [ ] search
- [ ] filters
- [ ] sort
- [ ] saved views
- [ ] add
- [ ] edit
- [ ] detail
- [ ] activity
- [ ] notes
- [ ] tasks
- [ ] convert
- [ ] import
- [ ] export
- [ ] bulk actions

## Contacts
- [ ] list
- [ ] detail
- [ ] related company
- [ ] related deals
- [ ] timeline
- [ ] tasks
- [ ] notes
- [ ] files
- [ ] duplicate warning

## Companies
- [ ] list
- [ ] detail
- [ ] contacts
- [ ] deals
- [ ] activity
- [ ] tasks
- [ ] files

## Deals
- [ ] board
- [ ] list view
- [ ] drag/drop
- [ ] optimistic rollback
- [ ] add
- [ ] edit
- [ ] detail
- [ ] timeline
- [ ] mark won
- [ ] mark lost
- [ ] reopen
- [ ] attention logic

## Tasks
- [ ] My Tasks
- [ ] Today
- [ ] Upcoming
- [ ] Overdue
- [ ] Completed
- [ ] quick complete
- [ ] edit/reschedule
- [ ] related entity
- [ ] calendar widget

## Dashboard
- [ ] KPI queries
- [ ] attention deals
- [ ] tasks today
- [ ] pipeline chart
- [ ] source chart
- [ ] recent activity

## Reports
- [ ] revenue trend
- [ ] pipeline by stage
- [ ] deals by source
- [ ] win/loss
- [ ] activity by rep
- [ ] date filter
- [ ] owner filter
- [ ] pipeline filter
- [ ] export if supported

## Search / Notifications
- [ ] command search
- [ ] grouped entity results
- [ ] notifications
- [ ] mark read

## Settings
- [ ] profile
- [ ] workspace
- [ ] team
- [ ] roles
- [ ] pipelines
- [ ] tags
- [ ] import history

## UX / Visual
- [ ] dashboard reference matched
- [ ] leads reference matched
- [ ] deals reference matched
- [ ] deal detail reference matched
- [ ] contact detail reference matched
- [ ] tasks reference matched
- [ ] reports reference matched
- [ ] loading states
- [ ] empty states
- [ ] error states
- [ ] mobile QA
- [ ] accessibility basics

## Security
- [ ] RLS every business table
- [ ] no cross-workspace reads
- [ ] no cross-workspace mutations
- [ ] role checks
- [ ] service key server-only
- [ ] file access policies
- [ ] Viewer cannot mutate

## Quality
- [ ] no dead buttons
- [ ] no fake metrics
- [ ] no console errors
- [ ] no placeholder MVP actions
- [ ] lint passes
- [ ] typecheck passes
- [ ] unit tests pass
- [ ] integration tests pass
- [ ] E2E critical flows pass
