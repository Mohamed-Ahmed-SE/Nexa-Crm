---
version: 1
slug: "app-app-workspace-tasks-page-tsx"
primary_target: "app/app/(workspace)/tasks/page.tsx"
related_targets:
  - "app/app/(workspace)/tasks/tasks-workspace.tsx"
  - "app/app/(workspace)/tasks/actions.ts"
  - "app/app/(workspace)/tasks/loading.tsx"
  - "app/app/(workspace)/tasks/error.tsx"
  - "app/dashboard.css"
---

# Tasks workspace surface brief

## Scope

Extend the existing Nexa CRM workspace into a usable, workspace-backed task list. Preserve the established cool-gray, white, blue-accented compact Geist interface and app shell; this is a reference-led extension, not a new visual world. The task list is the primary surface, following `docs/05-screen-specifications.md` (Tasks, lines 485–532), `docs/06-design-system.md`, `docs/16-visual-ui-specification.md`, and `docs/references/06-tasks.png`.

## Task and success

Help a workspace user find the next follow-up, create a task, and complete it quickly. Success means persisted tasks are searched, filtered, viewed by meaningful date/status tabs, paginated, related records open at valid routes, and authorized users can create and complete tasks with clear feedback.

## Constraints

- Default to My Tasks (assigned to the current user); provide Today, Upcoming, Overdue, and Completed views with correct status/due-date semantics.
- Support search and useful filters, task creation (including an optional validated related record), quick completion, and related-record links.
- Enforce `crm.view`, `crm.create`, `crm.edit.own`, `crm.edit.all`, and `crm.reassign` server-side, workspace-scoped queries/mutations, schema validation, and RLS. Never trust client-supplied workspace or role.
- Viewers cannot create or complete tasks. Assignment beyond self is for users with `crm.reassign` only.
- Keep the surface compact, accessible, responsive, and honest in empty, loading, and error states.
- Defer KPI cards, calendar/summary rail, custom columns, export, bulk actions, and unrelated editing/cancellation. Do not change global tokens, shell, source-of-truth docs, or `DESIGN.md`.
- Complete with the finish review and provenance discipline; no screenshot-based review is available in this environment.

## Direction contract

### THESIS

A follow-up is actionable when its owner, due date, status, and relationship are immediately legible; let the task list—not dashboard metrics—lead.

### OWN-WORLD

Inherit the current cool-gray/white/blue compact Geist app styling and shell. Preserve existing global tokens and components; add task-specific styling only.

### STORY

Open on the user's assigned work, then offer date/status-focused tabs, search and filters, a direct create path, and a one-step completion action. Keep task type, title, relation, due date, assignee, priority, and status scannable in that order.

### FIRST VIEWPORT

Show the Tasks heading and concise purpose, Add Task, the five requested views, search/filters, and the first rows without KPI cards or a summary rail. At narrow widths, keep actions reachable and the table usable without shrinking its content into illegibility.

### FORM

Use a labeled, accessible inline or compact creation form with title, type, priority, due date, assignee when permitted, and optional related entity; explain pending/success/error states. Ground composition in `docs/05-screen-specifications.md` lines 485–532 and `docs/references/06-tasks.png`. No concept-seed applies: this is the user's precisely specified reference-led extension.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
