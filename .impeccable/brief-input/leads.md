# Leads surface

## Scope and visitor mode
Operate: authenticated, workspace-scoped Leads list at `/app/leads`.

## Audience and job
Sales representatives and managers need to scan, find, and maintain prospect records while keeping ownership and follow-up context clear.

## Task, proof, and constraints
Success: list, search, filter, create, and edit actual records from the current workspace, with role and RLS enforcement and honest loading, empty, and error states. Use values from the database only; do not add demo records, fabricated KPIs, or fake insights. Lead conversion, import/export, timeline, tags, and bulk actions remain later slices. Keep the approved reference hierarchy and make narrow screens usable without wide-table scrolling.

## Direction contract

THESIS: Make prospect work actionable in one compact list; refuse a chart-led dashboard that hides the records.

OWN-WORLD: Extend the incumbent cool-gray canvas, white surfaces, restrained blue accent, thin borders, compact Geist typography, and small controls; do not alter global design tokens or the authenticated shell.

STORY: Reps scan who needs attention, narrow by query/status/source, then add or edit a lead; every displayed count and row comes from workspace data.

FIRST VIEWPORT: Keep the Leads title and primary Add Lead action at the top, a compact derived status summary below, then search/status/source filters and a dense table. Switch to readable stacked record cards on mobile; never fabricate insight widgets to fill space.

FORM: Use the approved `02-leads.png` / screen-spec hierarchy as the fixed structure; this precisely specified extension skips concept-seed, so no seed key applies.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
