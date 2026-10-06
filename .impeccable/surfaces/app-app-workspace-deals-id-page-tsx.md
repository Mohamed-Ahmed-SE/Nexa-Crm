---
version: 1
slug: "app-app-workspace-deals-id-page-tsx"
primary_target: "app/app/(workspace)/deals/[id]/page.tsx"
related_targets: ["app/app/(workspace)/deals/[id]/deal-detail-workspace.tsx", "app/dashboard.css"]
---

# Deal detail surface

## Scope and visitor mode
Operate: authenticated, current-workspace, read-only deal overview at `/app/deals/[id]`, as a precise extension of the established Deals world.

## Audience and job
Sales representatives, managers, and account managers need to understand one deal's value, stage, timing, ownership, description, and current company/contact relationships without entering an edit workflow.

## Constraints and mapped implementation
Follow `docs/05-screen-specifications.md` (Deal Detail, lines 432–481), `docs/07-data-model.md`, and the supplied `docs/references/04-deal-detail.png`. Keep the CRM's compact cool-gray/white/blue Geist treatment and existing workspace shell. Require `crm.view` on the server, validate the UUID, and query only non-archived records in the resolved workspace; inaccessible records share not-found behavior. Render only actual deal fields and workspace-scoped active relationships, with source shown only when it resolves safely. Keep loading and retryable error states accessible. Company and primary-contact links go to existing detail routes. Preserve deal-title edit behavior on the board and list while providing independent detail links for every role. Do not add mutations, fabricated owners/metrics/activities/files/tags/tasks, placeholder action controls, unsupported workflow tabs, schema changes, global token changes, or edits to source-of-truth docs.

## Direction contract

THESIS: make one persisted opportunity understandable without conflating read access and edit permission;
OWN-WORLD: extend the established compact cool-gray/white/blue Geist CRM, preserving global tokens and the application shell;
STORY: return to Deals, scan the opportunity summary, then inspect actual properties and linked company/contact records;
FIRST VIEWPORT: breadcrumb and deal identity lead, value/probability/close/stage remain prominent, with overview and compact properties below;
FORM: reference-led extension specified by `docs/05-screen-specifications.md` and `docs/references/04-deal-detail.png`; concept-seed was intentionally skipped for this narrow specified task;
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
