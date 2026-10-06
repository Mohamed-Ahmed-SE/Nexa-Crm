# Nexa CRM — MVP Product + UX + Build Documentation

This repository documentation defines the complete MVP for **Nexa CRM**, a real B2B sales CRM intended both as a working product and as a portfolio case study.

The product should solve genuine sales-team problems:

- customer data scattered across spreadsheets, chat, notes, and inboxes,
- leads being forgotten after first contact,
- unclear deal ownership,
- missed follow-ups,
- weak visibility into pipeline health,
- managers relying on manual status updates,
- no reliable relationship history,
- poor reporting on where revenue is coming from.

The product should feel like a polished modern SaaS CRM, not an admin-template demo.

## Visual direction

The implementation must follow the Nexa CRM visual system shown in `/docs/references`.

These references are the primary visual target for:

- app shell,
- sidebar,
- top navigation,
- spacing,
- typography hierarchy,
- cards,
- KPI widgets,
- tables,
- filter bars,
- status pills,
- forms,
- detail pages,
- Kanban board,
- reports,
- task views,
- density,
- border radius,
- shadows,
- interaction hierarchy.

Do not copy the textual sample data from the reference images literally unless it is part of the seed dataset. Recreate the design system and interaction model.

## Reference screens

- `references/01-dashboard.png`
- `references/02-leads.png`
- `references/03-deals-kanban.png`
- `references/04-deal-detail.png`
- `references/05-contact-detail.png`
- `references/06-tasks.png`
- `references/07-reports.png`

## Product stack

Recommended:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- PostgreSQL Row Level Security
- Zod
- React Hook Form
- TanStack Table
- Recharts
- date-fns
- Vitest + React Testing Library
- Playwright

## Source-of-truth rules

When requirements conflict, use this priority:

1. Security and data-isolation requirements
2. Product requirements / business rules
3. User flows
4. Screen specifications
5. Visual references
6. Developer convenience

The visual references define appearance, not new product scope.

For example, a visual item such as a "Messages" link should not create a new messaging platform unless a product document explicitly includes it.

## Documents

1. `01-product-brief.md`
2. `02-prd-mvp.md`
3. `03-information-architecture.md`
4. `04-ux-user-flows.md`
5. `05-screen-specifications.md`
6. `06-design-system.md`
7. `07-data-model.md`
8. `08-permissions-security.md`
9. `09-api-server-actions.md`
10. `10-business-rules.md`
11. `11-seed-data-demo.md`
12. `12-testing-acceptance.md`
13. `13-build-plan.md`
14. `14-codex-master-prompt.md`
15. `15-definition-of-done.md`
16. `16-visual-ui-specification.md`
17. `17-component-library.md`
18. `18-form-and-modal-specification.md`
19. `19-case-study-framework.md`
20. `20-visual-reference-map.md`
21. `21-implementation-checklist.md`
22. `mvp-manifest.json`

## Non-negotiable implementation principles

- No fake navigation.
- No dead primary buttons.
- No fake dashboard metrics.
- No purely decorative filters.
- No hardcoded customer records in production components.
- Every mutation has validation, loading, success, and error behavior.
- All important data permissions are enforced server-side/database-side.
- Every major page supports empty, loading, error, and populated states.
- Mobile workflows must remain usable.
- The final product must look like one cohesive design system.
