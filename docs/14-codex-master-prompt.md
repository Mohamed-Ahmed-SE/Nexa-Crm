# 14 — Codex Master Prompt

You are the lead engineer and product-minded frontend/backend developer building **Nexa CRM**.

This is not a static dashboard exercise. Build a real, production-quality CRM MVP using the `/docs` folder as the source of truth.

## Mandatory first step

Before changing code:

1. Read every Markdown file in `/docs`.
2. Read `mvp-manifest.json`.
3. Inspect every image in `/docs/references`.
4. Audit the existing repository.
5. Produce a concise implementation plan mapped to the documents.
6. Record necessary ambiguities in `/docs/implementation-decisions.md`.

Do not start by generating a giant speculative code dump.

---

# Product Goal

Nexa CRM solves practical small/mid-size sales-team problems:

- scattered customer data,
- missed follow-ups,
- unclear deal ownership,
- poor relationship history,
- weak pipeline visibility,
- inconsistent sales process,
- manual reporting.

The MVP must support:

- authentication
- onboarding
- workspace/team
- roles/permissions
- dashboard
- leads
- contacts
- companies
- deals
- Kanban pipeline
- tasks
- activities
- notes
- attachments
- reports
- search
- notifications
- CSV import/export
- settings

Do not expand the MVP into accounting, marketing automation, telephony, WhatsApp, AI assistant, full email synchronization, support tickets, or workflow automation.

---

# Visual Requirement

The application must visually follow the approved Nexa CRM design system in `/docs/references`.

Use the visual references as the main target for:
- spacing
- density
- sidebar
- topbar
- cards
- KPI blocks
- tables
- buttons
- filters
- status pills
- forms
- Kanban
- detail-page rails
- timelines
- reports/charts

The product should look like one cohesive system.

Do not independently redesign each screen.

Do not introduce:
- glassmorphism,
- dark gradient cards,
- giant fonts,
- oversized radius,
- heavy shadows,
- decorative animation.

Prefer a polished light SaaS UI.

---

# Recommended Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- PostgreSQL RLS
- Zod
- React Hook Form
- TanStack Table
- Recharts
- date-fns
- Vitest + RTL
- Playwright

Use stable compatible dependency versions and commit the lockfile.

---

# Architecture

Use clean boundaries:

```text
UI
 -> route/action/controller
 -> validation
 -> authorization
 -> service/business rule
 -> repository/database
```

Rules:
- no scattered raw DB logic in presentation components
- no authorization based only on hidden UI
- server-only secrets remain server-only
- reusable validation schemas
- centralized permissions
- centralized business rules
- query-state encoded predictably in URL where useful
- reusable table/filter infrastructure

---

# Database

Implement `07-data-model.md`.

Every business record belongs to a workspace.

Enforce isolation through RLS and server checks.

Cross-workspace access is a release blocker.

---

# Business Logic

Implement `10-business-rules.md`.

Important:
- deal stage/status consistency
- pipeline probability
- lead conversion
- overdue tasks
- stale/attention rules
- won/lost behavior
- duplicate warnings
- dashboard aggregates
- report definitions

---

# UX

Follow:
- `04-ux-user-flows.md`
- `05-screen-specifications.md`
- `06-design-system.md`
- `16-visual-ui-specification.md`
- `17-component-library.md`
- `18-form-and-modal-specification.md`
- `20-visual-reference-map.md`

All visible MVP actions must work.

Every major route must have:
- loading
- empty
- empty after filtering
- error
- forbidden/unauthorized when applicable
- populated state

Every mutation needs:
- validation
- loading
- success feedback
- recoverable error behavior

---

# Reusable UI

Build reusable primitives for:
- app shell
- data tables
- filters
- saved views
- pagination
- forms
- owner selectors
- status pills
- tags
- timelines
- deal cards
- Kanban columns
- notes
- task rows
- property rails

Do not build one-off versions for every page.

---

# Implementation Order

Follow `13-build-plan.md`.

Recommended:
1. foundation
2. auth/workspace/security
3. migrations
4. seed data
5. shell/design system
6. leads/contacts/companies
7. deals
8. tasks/activity
9. dashboard
10. reports
11. search/notifications
12. import/export/settings
13. mobile/accessibility/performance
14. E2E hardening

Keep the app runnable after every phase.

---

# Visual Validation

After implementing each reference screen:

1. open the corresponding image under `/docs/references`
2. compare layout side-by-side
3. adjust:
   - padding
   - density
   - widths
   - font sizes
   - card radius
   - button sizing
   - borders
   - muted colors
   - table row height
   - chart spacing
4. do not sacrifice accessibility or responsive behavior for pixel perfection

---

# Seed Data

Implement realistic seed data from `11-seed-data-demo.md`.

Do not hardcode dashboard values.

All KPI values and charts must derive from data.

---

# Tests

Before a phase is complete run:
- lint
- typecheck
- relevant unit/integration tests

Critical workflows need E2E:
- sign in
- create lead
- create task
- log activity
- convert lead
- create deal
- drag deal stage
- mark won/lost
- search
- filter
- import
- permission denial

---

# Progress Report

After each phase output:

1. files changed
2. migrations
3. functionality completed
4. screenshots/routes completed
5. tests run
6. known issues
7. next step

---

# Definition of success

The project is complete only when it satisfies:
- `12-testing-acceptance.md`
- `15-definition-of-done.md`
- `21-implementation-checklist.md`

Start with the repository audit and Phase 0.
