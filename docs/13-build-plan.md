# 13 — Build Plan

## Phase 0 — Foundation

- bootstrap app
- configure TypeScript
- Tailwind
- shadcn/ui
- lint/format
- environment validation
- Supabase clients
- testing setup
- base app shell

Deliverable:
authenticated skeleton app.

---

## Phase 1 — Auth, workspace, permissions

- sign in/reset
- profiles
- workspace creation
- members
- role helpers
- RLS baseline
- protected routes
- onboarding

Deliverable:
secure multi-user workspace.

---

## Phase 2 — CRM core model

- pipelines/stages
- leads
- contacts
- companies
- deals
- tags
- sources
- lost reasons
- migrations
- seed data

Deliverable:
database and basic CRUD.

---

## Phase 3 — Core reusable UI

- AppShell
- sidebar/topbar
- PageHeader
- DataTable
- filter system
- entity fields
- forms
- QuickCreate
- Global Search shell

Deliverable:
consistent UX foundation.

---

## Phase 4 — Leads, Contacts, Companies

- list pages
- detail pages
- create/edit
- timeline
- notes
- tasks
- tags
- conversion

Deliverable:
complete lead-to-customer foundation.

---

## Phase 5 — Deals pipeline

- board
- DnD
- list view
- deal detail
- won/lost
- stage history
- attention indicators

Deliverable:
usable sales pipeline.

---

## Phase 6 — Tasks and activities

- task pages
- due/overdue
- quick complete
- calls/emails/meetings
- unified timeline

Deliverable:
daily sales workflow.

---

## Phase 7 — Dashboard and reports

- KPI queries
- charts
- attention engine
- reports
- filters

Deliverable:
management visibility.

---

## Phase 8 — Search, notifications, saved views

- global search
- notification center
- saved filters/views

Deliverable:
productivity layer.

---

## Phase 9 — Import/export and settings

- CSV wizard
- export
- user settings
- pipeline settings
- tags/settings
- member management

Deliverable:
operational self-service.

---

## Phase 10 — Hardening

- E2E
- permission tests
- mobile QA
- accessibility QA
- performance
- empty/error states
- seed polish
- production checklist

## Codex task sizing

Codex should not implement the entire project in one uncontrolled pass.

Preferred iteration:

1. read docs
2. inspect repository
3. produce implementation checklist
4. implement one vertical slice
5. run lint/typecheck/tests
6. fix
7. commit-ready summary
8. continue next slice

Each phase should leave the project runnable.
