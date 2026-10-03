# Implementation Decisions

## Phase 0 plan

| Phase | Source of truth | Initial deliverable |
|---|---|---|
| Foundation | `13-build-plan.md` (Phase 0), `06-design-system.md`, `16-visual-ui-specification.md`, `17-component-library.md`, `21-implementation-checklist.md` | Runnable, typed app shell with shared navigation and tested visual tokens |
| Auth/workspace/security | `02-prd-mvp.md`, `07-data-model.md`, `08-permissions-security.md`, `09-api-server-actions.md` | Protected multi-tenant workspace and role enforcement |
| CRM core | `07-data-model.md`, `10-business-rules.md`, `11-seed-data-demo.md` | Workspace-scoped entities, migrations, and realistic seed data |
| CRM workflows | `02-prd-mvp.md`, `03-information-architecture.md`, `04-ux-user-flows.md`, `05-screen-specifications.md`, `18-form-and-modal-specification.md` | Leads, contacts, companies, deals, tasks, and activity workflows |
| Visibility and operations | `02-prd-mvp.md`, `09-api-server-actions.md`, `12-testing-acceptance.md` | Data-derived dashboard/reports, search, notifications, imports/exports, settings |
| Hardening | `12-testing-acceptance.md`, `15-definition-of-done.md`, `19-case-study-framework.md`, `20-visual-reference-map.md`, `21-implementation-checklist.md` | Responsive/accessibility/security review, E2E coverage, and verified release checklist |

The repository audit found only the brief root `README.md` and the supplied `/docs` requirements and visual references; no app, package manifest, or existing test/tooling configuration is present. All seven visual references were inspected. The first implementation slice should therefore bootstrap the foundation only and leave the project runnable; it must not claim the full CRM MVP is complete.

## Decisions / constraints

- Follow the recommended Next.js App Router + TypeScript + Tailwind direction unless repository/environment constraints establish an incompatibility; choose stable compatible packages and retain the lockfile.
- The exact hosting/auth/database credentials and deployment target are absent. Never invent or commit secrets; document configuration as environment variables and keep any external service optional for the initial shell.
- Use the supplied light, compact B2B visual language consistently. The mockups are layout/style targets, not authorization to add Messages or other excluded modules.
- Implement features in vertical slices in the order of `13-build-plan.md`. Enforce workspace isolation and role permissions on the server/database before exposing real multi-tenant data.
- Keep the existing docs and user-owned files intact; make only necessary, runnable changes per slice.
