---
version: 1
slug: "app-app-workspace-reports-page-tsx"
primary_target: "app/app/(workspace)/reports/page.tsx"
related_targets:
  - "app/app/(workspace)/reports/reports-workspace.tsx"
  - "app/app/(workspace)/reports/loading.tsx"
  - "app/app/(workspace)/reports/error.tsx"
  - "lib/reports/schema.ts"
  - "lib/reports/repository.ts"
  - "supabase/migrations/202604030009_workspace_reports.sql"
  - "app/dashboard.css"
---

# Reports workspace surface brief

## Scope

Replace the Reports placeholder with a persisted, workspace-scoped analytics surface. Preserve the compact light Geist CRM shell, established cool-gray/white/blue interface, and reference density. This is an extension, not a redesign. Sources: `docs/02-prd-mvp.md` Reports, `docs/05-screen-specifications.md` §11 (lines 555–586), `docs/07-data-model.md`, `docs/10-business-rules.md` currency and win-rate sections, `docs/12-testing-acceptance.md` Reports criteria, `docs/15-definition-of-done.md`, `docs/16-visual-ui-specification.md` Reports, `docs/references/07-reports.png`, and `PRODUCT.md`.

## User and success

Help workspace members understand closed revenue, deal mix, current open pipeline, sales sources, outcomes, and logged human activity. Success means every filter affects its named date/owner/pipeline scope, figures come only from visible persisted workspace data, and CSV export represents the selected report.

## Constraints

- Require `reports.view`; resolve workspace and user context server-side; use explicit workspace constraints and existing RLS. No client-supplied workspace/role or service key.
- Apply lower-inclusive/upper-exclusive date boundaries. Deal creation metrics use `created_at`; won/lost metrics use `won_at`/`lost_at`; activity metrics use `occurred_at` and exclude system events. Open deals never enter the win-rate denominator.
- Aggregate only workspace-default-currency deals. Label the date meaning of each metric. Current pipeline stage values are a current snapshot, not historical stage conversion.
- Use bounded database aggregation, real data only, no synthetic periods, and an explicitly named highest-value deal table. Charts remain legible without color as the only encoding; filters, export, empty/loading/error states, keyboard focus, and narrow layouts work.
- Keep the existing shell, components, tokens, and CSS vocabulary. Do not edit `PRODUCT.md`, existing briefs, source-of-truth docs, or create/edit `DESIGN.md`. No screenshot/browser review is claimed unless performed.

## Direction contract

### THESIS

Make report scope and metric meaning visible before inviting comparison; no number should look more certain or more current than its source data.

### OWN-WORLD

Inherit the compact light Geist CRM shell, cool neutrals, restrained blue accent, compact panels, and existing type/spacing patterns. Extend only report-specific styles.

### STORY

Start with date, owner, pipeline, and export controls; follow with four concise KPIs; give Revenue Trend and current Pipeline by Stage the primary chart row; keep source, win/loss, and human activity analyses compact; finish with a table explicitly ranked by deal amount.

### FIRST VIEWPORT

Show Reports, a short purpose statement, labeled date/owner/pipeline controls, export, and the four KPI cards. Keep chart headings, axes/labels, values, and text equivalents clear. On mobile, stack charts and keep filters and export reachable without horizontal page overflow.

### DATA AND STATES

No demo numbers, seeded examples, invented trend points, or fabricated identities. Show honest no-data/no-matching-record states, a readable loading state, and a recovery-oriented error. State that revenue charts and deals follow the chosen date range using creation or closure dates as labeled; the current open pipeline snapshot is not date-based.
