# 04 — UX and User Flows

## UX philosophy

The application should answer three questions quickly:

1. What is happening?
2. What needs my attention?
3. What should I do next?

Avoid forcing users through unnecessary pages.

Prefer:

- inline editing for small field changes,
- drawers/sheets for quick create,
- detail page for complex history,
- keyboard-friendly commands,
- obvious next actions,
- contextual defaults.

---

# Flow A — New inbound lead

1. User clicks `Create > Lead`.
2. Quick-create drawer opens.
3. Required: name.
4. Optional: company, email, phone, source, owner, value.
5. User saves.
6. Lead appears in `New`.
7. System logs `Lead created`.
8. Detail page suggests:
   - Log activity
   - Create follow-up task
   - Qualify lead
9. User calls prospect and logs call.
10. User schedules follow-up.
11. Task appears on dashboard.

### Success experience

The user never needs to manually copy the same data into tasks or activities.

---

# Flow B — Qualify and convert a lead

1. Open lead.
2. Click `Qualify / Convert`.
3. Modal shows:
   - create contact: checked
   - create company: checked if company exists
   - create deal: checked
4. User confirms/edit proposed names.
5. User chooses initial deal stage, value, close date.
6. System creates records transactionally.
7. Existing lead activity appears on resulting records.
8. Lead becomes `Converted`.
9. User lands on deal detail.

### Failure handling

If conversion fails, do not leave partial orphan records.

---

# Flow C — Manage a deal

1. User sees deal in Kanban.
2. Opens card preview or full deal.
3. Adds meeting note.
4. Updates expected close date.
5. Creates next task.
6. After proposal is sent, drag card to `Proposal`.
7. System logs stage change.
8. Dashboard pipeline updates.
9. Later move to `Won`.
10. Prompt asks for final amount and optional closing note.
11. System stores win date.

---

# Flow D — Lost deal

1. User clicks `Mark lost`.
2. Dialog requires lost reason.
3. Optional competitor/free text.
4. Confirm.
5. Deal moves to Lost.
6. Open tasks related to that deal prompt:
   - keep,
   - complete,
   - cancel.
7. Timeline logs lost reason.

---

# Flow E — Daily sales rep workflow

### Morning

Dashboard shows:

- overdue tasks,
- tasks due today,
- deals needing attention,
- recently active deals.

Rep works task queue.

### During work

Each completed call/email can be logged in 1–2 interactions.

After completing an activity, prompt for next action:

- Add follow-up
- No follow-up

This encourages a clean pipeline without forcing it.

### End of day

Rep can filter tasks to `Tomorrow` or check overdue remaining items.

---

# Flow F — Manager pipeline review

1. Open Deals.
2. Select pipeline.
3. Filter by owner/team.
4. Review column totals.
5. Open a deal.
6. See last activity and next task.
7. Use attention indicators to find:
   - no next task,
   - stale deal,
   - overdue close date.
8. Reassign or leave note.

---

# Flow G — CSV import

1. User opens Settings > Imports.
2. Select entity type.
3. Drop CSV.
4. Header mapper auto-suggests fields.
5. User resolves unmapped required fields.
6. Preview first 10 rows.
7. Invalid rows clearly identify error.
8. User chooses:
   - skip invalid rows
   - cancel/fix file
9. Confirm.
10. Background/queued operation may be used for large files.
11. Results page shows created/skipped/error count.

---

# Flow H — Search and jump

1. User presses `Cmd/Ctrl + K`.
2. Search opens immediately.
3. User types company/contact/deal name.
4. Results grouped by entity.
5. Keyboard arrows select.
6. Enter opens record.

---

# UX state requirements

Every data screen must intentionally support:

- loading/skeleton,
- empty,
- empty-after-filter,
- error,
- unauthorized,
- success feedback,
- slow network mutation,
- destructive confirmation.

## Empty-state examples

### No leads
"Your leads will appear here. Add your first lead or import a CSV."

Actions:
- Add lead
- Import CSV

### No tasks today
"Nothing due today."

Secondary:
"View upcoming tasks"

### Empty pipeline
"No deals in this stage."

Action:
"Create deal"
