# 05 — Screen Specifications

This document defines the complete MVP screen set. Visual appearance must follow `/docs/references`.

---

# Global App Shell

## Desktop

### Sidebar

Width target: 232–256px.

Top:
- Nexa CRM mark
- workspace/product name
- compact search / command shortcut

Primary navigation:
- Dashboard
- Leads
- Contacts
- Companies
- Deals
- Tasks
- Reports

Optional navigation depending on implementation:
- Notifications shortcut

Settings section:
- Team / Users
- Integrations placeholder only if integrations are intentionally surfaced
- Settings

Bottom:
- user/workspace helper area
- no fake paid-plan upgrade card unless the product is intentionally presented as SaaS with plans

### Top bar

- global search centered or left-center
- notification button
- optional teammate avatars for collaboration context
- signed-in user avatar/name/role
- responsive collapse on smaller widths

Top bar stays visually light and should not dominate content.

---

# 1. Authentication

## Sign In

- Nexa CRM brand
- email
- password
- show/hide password
- forgot password
- submit
- error feedback
- loading state

Use the same design language as the app:
- white card
- thin border
- soft gray background
- restrained radius
- no oversized illustration dependency

## Reset Password

- email request
- token/reset form
- new password
- confirmation

---

# 2. Onboarding

Multi-step contained card.

Steps:
1. Workspace details
2. Your role
3. Pipeline template
4. Optional import
5. Invite teammates
6. Done

Progress indicator should be compact.

Primary action is dark/brand-emphasis.
Secondary actions remain neutral outline/text.

---

# 3. Dashboard

Visual reference:
`references/01-dashboard.png`

## Header

- `Sales Dashboard`
- supportive subtitle
- optional date-range filter
- quick create

## KPI row

Cards:
- Total Pipeline Value
- Open Deals
- New Leads
- Won Revenue
- Overdue Tasks

Each card:
- small semantic icon container
- label
- large value
- comparison text where valid
- overflow only if it has real purpose

## Main workspace area

Primary table/widget:
- Deals or sales overview table
- Table / Kanban toggle
- Filter
- Sort
- Export
- Add Deal

Recommended columns:
- Contact
- Company
- Stage
- Value
- Owner
- Next Activity
- Status

Do not add "Rating" unless product logic actually uses deal/contact scoring.

## Supporting widgets

- Pipeline by Stage
- Deals / Leads by Source
- Recent Activity
- Tasks Due Today
- Deals Needing Attention

Charts should be secondary to operational actions.

---

# 4. Leads

Visual reference:
`references/02-leads.png`

## Header

- Leads
- descriptive subtitle
- Import CSV
- Add Lead

## KPI row

- Total Leads
- New Leads
- Qualified Leads
- Conversion Rate

Use actual data and selected date scope.

## Toolbar

- search
- Status
- Owner
- Source
- Tags
- Saved View
- Sort
- Export

## Table

Columns:
- checkbox
- Name
- Company
- Status
- Source
- Owner
- Estimated Value
- Last Activity
- Next Activity
- Tags
- actions

Statuses:
- New
- Contacted
- Qualified
- Unqualified
- Converted

Use compact colored pills.

## Bottom widgets

Optional but recommended:
- Leads by Source
- Leads by Status
- Recent Leads

---

# 5. Lead Detail

Header:
- lead name
- company
- status
- owner
- estimated value
- last/next activity

Primary actions:
- Convert
- Log Activity
- Add Task

Sections:
- Overview
- Activity
- Tasks
- Notes
- Files if attachments implemented

Right rail:
- properties
- source
- tags
- contact fields
- owner
- created date

Conversion should be prominent but not visually destructive.

---

# 6. Contacts

## Contacts List

Use same system as Leads:
- page header
- KPI only if useful
- search/filter bar
- data table
- pagination
- saved view

Columns:
- Name
- Company
- Job Title
- Email
- Phone
- Owner
- Lifecycle
- Last Activity
- Next Activity
- Tags

## Contact Detail

Visual reference:
`references/05-contact-detail.png`

Header:
- avatar
- name
- lifecycle/status
- job title + company
- tags
- quick actions: Email, Call, Log Activity
- Edit Contact

Tabs:
- Overview
- Activity
- Deals
- Tasks
- Files

Main area:
- Recent Activity timeline
- Notes
- Related Deals table

Right rail:
- Contact Information
- Company summary
- Upcoming Task

Contact actions should feel operational, not profile-only.

---

# 7. Companies

## Company List

Columns:
- Company
- Industry
- Contacts
- Open Deals
- Pipeline Value
- Owner
- Last Activity
- Next Activity

## Company Detail

Header:
- logo/initial
- name
- domain
- industry
- employee band
- owner

Summary metrics:
- Open Deal Value
- Contacts
- Active Deals
- Last Activity

Sections:
- Overview
- Contacts
- Deals
- Activity
- Tasks
- Notes
- Files

Right rail:
- company properties
- key contacts
- next task

---

# 8. Deals Pipeline

Visual reference:
`references/03-deals-kanban.png`

## Header

- Deals
- subtitle
- date scope if useful

Controls:
- Pipeline selector
- Owner
- Close Date
- Sort
- Board / List toggle
- Export
- Add Deal

## Board

Columns:
- Discovery
- Qualified
- Proposal
- Negotiation
- Won
- Lost

Open stages should be configurable by admin.

Each column:
- stage name
- total amount
- deal count
- menu
- add deal action

Each card:
- deal title
- company
- amount
- close date
- owner avatar
- priority / attention state

Drag and drop:
- optimistic
- persist immediately
- rollback on failure
- timeline/audit event created

## Pipeline summary strip

Recommended:
- Total Pipeline Value
- Total Deals
- Average Deal Size
- Win Rate
- Stage Distribution

Do not let this summary crowd the board.

---

# 9. Deal Detail

Visual reference:
`references/04-deal-detail.png`

## Header

- breadcrumb
- deal title
- company
- stage
- value
- probability
- expected close
- owner

Actions:
- Log Activity
- Add Task
- Mark Won
- Mark Lost

## Tabs

- Overview
- Activity
- Tasks
- Meetings
- Files
- Contacts
- Company

## Main column

- Deal Summary
- Activity Timeline
- Recent Meetings
- Tasks

## Right rail

- Deal Properties
- Primary Contact
- Related Files

Property design:
- compact rows
- labels left
- values right
- editable through modal/drawer or inline controls

---

# 10. Tasks

Visual reference:
`references/06-tasks.png`

## Header

- Tasks
- subtitle
- date filter
- Add Task

## KPI cards

- Due Today
- Overdue
- Completed This Week
- Upcoming

## Tabs

- My Tasks
- Today
- Upcoming
- Overdue
- Completed

## Toolbar

- search
- filter
- sort
- customize columns
- export
- Add Task

## Table

Columns:
- checkbox
- Type
- Task Title
- Related To
- Due Date
- Assignee
- Priority
- Status
- actions

Task types:
- Call
- Email
- Meeting
- Follow-up
- To-do

Status examples:
- Not Started
- In Progress
- Pending
- Completed
- Cancelled

Right rail:
- small calendar
- Today's Tasks
- Task Completion summary

---

# 11. Reports

Visual reference:
`references/07-reports.png`

## Header filters

- date range
- owner
- pipeline
- export

## KPI cards

- Won Revenue / Total Revenue
- Total Deals
- Win Rate
- Average Deal Value

## Charts

- Revenue Trend
- Pipeline by Stage
- Deals by Source
- Win/Loss Summary
- Activity by Rep

## Bottom table

Top Performing Deals or equivalent useful table.

Do not show misleading "performance rankings" without defining the metric.

---

# 12. Global Search

Open with `Cmd/Ctrl + K`.

Grouped results:
- Leads
- Contacts
- Companies
- Deals

Result:
- name/title
- entity type
- small context
- owner/company if useful

Quick actions:
- Add Lead
- Add Contact
- Add Deal

---

# 13. Notifications

Panel/page:
- assigned record
- task due
- task overdue
- invite accepted
- deal won/lost if configured

Actions:
- mark read
- mark all read
- open related record

---

# 14. Settings

## Profile
- name
- avatar
- phone
- job title
- timezone
- date format

## Workspace
- workspace name
- logo
- currency
- timezone

## Team
- members table
- role
- status
- invited date
- deactivate/change role

## Pipeline
- name
- stages
- reorder
- probability
- active/disabled

## Tags
- create/edit/remove

## Imports
- jobs/history/error reports

---

# 15. CSV Import Wizard

Step 1:
Upload CSV

Step 2:
Map columns

Step 3:
Preview / validation

Step 4:
Confirm

Step 5:
Result summary

Design:
- same compact cards
- progress steps
- clear validation
- no giant modal

---

# 16. Mobile Behavior

The desktop references are not an excuse for desktop-only UX.

At ~390px:
- sidebar becomes sheet/drawer
- top search becomes icon/compact command trigger
- KPI cards horizontally scroll or stack
- tables switch to responsive card/list where needed
- Kanban remains horizontal scroll
- detail right rail moves below main content
- sticky bottom/overflow action area may be used
- forms become full-screen sheets where appropriate

Critical mobile actions:
- complete task
- call contact
- log activity
- add note
- update deal stage
- create lead
