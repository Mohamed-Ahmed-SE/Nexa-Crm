# 02 — Product Requirements Document

## 1. Authentication and onboarding

### Required

- sign in with email/password,
- sign out,
- forgot/reset password,
- protected authenticated routes,
- first-workspace onboarding,
- invite team member,
- accept invite,
- user profile,
- workspace name and basic information.

### First-run onboarding

Step 1: Welcome  
Step 2: Workspace name  
Step 3: User role/job title  
Step 4: Choose a pipeline template  
Step 5: Optional CSV import  
Step 6: Invite teammates  
Step 7: Enter dashboard

Onboarding must be skippable after the required workspace creation step.

---

## 2. Dashboard

Dashboard is the daily operating screen.

### KPI cards

- Open pipeline value
- Deals closing this month
- Won revenue this month
- New leads this month
- Overdue tasks

### Main sections

- Pipeline by stage
- Revenue trend
- Tasks due today
- Recently active deals
- Sales activity
- Deals needing attention

### "Needs attention" examples

- deal has no next activity,
- task overdue,
- deal closing date passed,
- no activity for X days,
- stale lead.

The logic should be defined centrally rather than duplicated in UI.

---

## 3. Leads

### Fields

- id
- full name
- company name
- email
- phone
- job title
- source
- status
- owner
- estimated value
- tags
- notes
- created date
- last activity date
- next activity date

### Lead statuses

- New
- Contacted
- Qualified
- Unqualified
- Converted

### Required actions

- create
- edit
- assign owner
- add note
- log activity
- create task
- add tags
- mark qualified/unqualified
- convert lead
- delete/archive
- bulk assign
- bulk tag
- CSV import/export

### Lead conversion

Conversion can create:

- Contact
- Company
- Deal

Allow the user to choose which records are created.

Preserve all notes/activities and associate them with the converted records.

---

## 4. Contacts

### Fields

- first name
- last name
- email
- phone
- title
- company
- owner
- tags
- address optional
- LinkedIn/profile URL optional
- notes
- lifecycle status
- created at

### Main features

- contact list
- search/filter/sort
- contact profile
- activity timeline
- related deals
- related tasks
- related company
- attachments
- duplicate warning by email/phone

---

## 5. Companies

### Fields

- company name
- website
- industry
- employee size band
- phone
- address
- owner
- tags
- description
- created at

### Company details

Show:

- overview,
- contacts,
- deals,
- activities,
- tasks,
- notes,
- attachments.

---

## 6. Deals / Opportunities

### Fields

- title
- company
- primary contact
- pipeline
- stage
- amount
- probability
- expected close date
- owner
- source
- priority
- tags
- description
- created at
- won/lost date
- lost reason

### Default pipeline

1. Discovery
2. Qualified
3. Proposal
4. Negotiation
5. Won
6. Lost

Admin may rename/reorder active non-terminal stages.

### Deal views

- Kanban board
- table/list
- deal detail

### Deal actions

- create/edit
- drag between stages
- log activity
- create task
- add note
- upload attachment
- mark won
- mark lost
- reopen
- change owner
- change value/date
- duplicate

### Kanban requirements

Each card shows:

- deal title
- company/contact
- value
- owner avatar
- expected close date
- next task indicator

Stage columns show:

- deal count
- total value

Drag-and-drop must use optimistic UI with rollback on failure.

---

## 7. Tasks

### Task types

- Call
- Email
- Meeting
- Follow-up
- To-do

### Fields

- title
- description
- type
- due date/time
- assignee
- priority
- status
- related record type
- related record id
- reminder flag
- completed at

### Views

- My tasks
- All tasks if permission allows
- Today
- Upcoming
- Overdue
- Completed

### UX

Quick completion must be possible directly from dashboard/list.

---

## 8. Activities and timeline

### Activity types

- call
- email
- meeting
- note
- task completed
- stage changed
- owner changed
- deal won/lost
- record created
- attachment uploaded

### Timeline

Every contact/company/deal/lead profile displays a unified chronological timeline.

System events are immutable.

Manual activities may be editable by creator/admin.

---

## 9. Notes

Support:

- plain/rich text note
- author
- created/updated time
- pinned state
- associated entity

Pinned notes appear near the top of record details.

---

## 10. Search

Global search from top navigation.

Search:

- leads
- contacts
- companies
- deals

Result groups should show entity type and relevant context.

Keyboard shortcut: `/` or `Cmd/Ctrl + K`.

---

## 11. Filters and saved views

Core lists support:

- owner
- status/stage
- tag
- source
- created date
- activity state
- amount ranges where relevant

Users can save a filtered view:

- name
- filters
- sort
- visible columns

MVP saved views are private by default.

---

## 12. Reports

### MVP reports

- deals by stage
- pipeline value by owner
- won revenue over time
- win/loss count
- lead source performance
- sales activity by user
- tasks completed vs overdue
- deal conversion funnel

### Report controls

- date range
- owner/team member
- pipeline

No custom report builder in MVP.

---

## 13. Notifications

In-app notification center.

Types:

- assigned to lead/deal
- task due
- task overdue
- mentioned in note/comment if mentions are implemented
- invite accepted
- deal marked won/lost where relevant to manager

MVP does not require push notifications.

---

## 14. Import/export

### CSV import

Entities:

- leads
- contacts
- companies

Flow:

1. Upload file
2. Detect headers
3. Map columns
4. Preview
5. Validate
6. Show errors
7. Confirm
8. Import
9. Show summary

### Export

Export currently filtered records to CSV.

---

## 15. User and workspace settings

### Profile

- name
- avatar
- phone optional
- job title
- timezone
- date format

### Workspace

- name
- logo
- default currency
- timezone
- fiscal/month preference optional

### Users

- invite
- deactivate
- change role
- view pending invites

### Pipeline settings

- rename stages
- reorder stages
- set default probability
- add stage
- disable stage if safe

---

## 16. Auditability

At minimum, write activity events for:

- record created,
- owner changed,
- stage/status changed,
- deal value changed,
- deal won/lost,
- task completion.

Admin audit log page is optional for first release, but data should exist.

---

## 17. Responsive requirements

Desktop: full sidebar + data-dense layouts.  
Tablet: collapsible sidebar.  
Mobile: bottom/compact navigation, cards replace wide tables where needed.

On mobile:

- dashboard KPIs horizontally scroll or stack,
- deal board supports horizontal stage scrolling,
- record actions are in a sticky action area or overflow menu,
- forms use single-column layout,
- drawers become full-screen sheets.

---

## 18. Accessibility

- visible focus states
- keyboard navigation
- proper labels
- semantic buttons/links
- aria labels where icon-only
- sufficient contrast
- no information communicated by color only
- modal focus trapping
- reduced-motion support
