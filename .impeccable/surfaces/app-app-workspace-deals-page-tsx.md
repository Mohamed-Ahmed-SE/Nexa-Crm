---
version: 1
slug: "app-app-workspace-deals-page-tsx"
primary_target: "app/app/(workspace)/deals/page.tsx"
related_targets: ["app/app/(workspace)/deals/deals-workspace.tsx", "app/dashboard.css"]
---

# Deals surface

## Scope and visitor mode
Operate: authenticated, current-workspace Deals pipeline board/list at `/app/deals`.

## Audience and job
Sales representatives and managers scan pipeline stages, filter actual deal records, create or edit deals, and advance work without losing ownership or context.

## Constraints and mapped implementation
Implement this incremental Phase 5 slice against `02-prd-mvp.md` (Deals), `05-screen-specifications.md` (Board and Deal Detail), `06-design-system.md`, `07-data-model.md`, `08-permissions-security.md`, `09-api-server-actions.md`, `10-business-rules.md`, `13-build-plan.md` (Phase 5), and `15-definition-of-done.md`. Use database-backed records and aggregates, RLS plus server-side authorization/relation validation, persisted stage order, optimistic moves with rollback, accessible keyboard alternatives, real loading/empty/error/validation states, and responsive board/list layouts. Show the primary contact and owner identity on deal cards. Mark attention only for open deals whose expected close date is before today; do not infer task- or activity-based attention because those workflows are not implemented in this slice. Do not fabricate records or KPIs, bypass RLS, expose secrets, change global tokens or shell, or imply unimplemented Won/Lost outcomes or Deal Detail work is available. Reuse existing schemas, server client, auth, and visual conventions. Do not edit `DESIGN.md` or other modules.

## Direction contract

THESIS: reps advance work from pipeline records rather than a chart-led dashboard;
OWN-WORLD: inherit the existing cool-gray/white/blue compact Geist system with semantic stage accents and no token/shell changes;
STORY: scan stages, filter deals, create/edit a deal, and move it forward with database-backed totals;
FIRST VIEWPORT: Deals heading and Add Deal, compact toolbar/view switch, stage columns showing totals/counts/cards, summary kept secondary;
FORM: the precisely specified board/list from docs 05 and image 03, no concept seed;
FINISH: `unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance`.
