# 03 — Information Architecture

## Main application navigation

### Workspace shell

- Logo / Workspace switcher
- Dashboard
- Leads
- Contacts
- Companies
- Deals
- Tasks
- Reports
- Settings

Bottom of sidebar:

- Help
- Notifications
- User menu

Top bar:

- breadcrumb/page title
- global search
- quick create
- notifications
- user avatar

## Quick Create

The `+ Create` action opens a command-style menu:

- Lead
- Contact
- Company
- Deal
- Task
- Note

The create flow should remember context when launched from a detail page.

Example:
Creating a task while viewing a deal automatically relates the task to that deal.

## Route map

```text
/auth/sign-in
/auth/forgot-password
/auth/reset-password

/onboarding

/app
  /dashboard
  /leads
  /leads/[leadId]
  /contacts
  /contacts/[contactId]
  /companies
  /companies/[companyId]
  /deals
  /deals/[dealId]
  /tasks
  /reports
  /notifications

/app/settings
  /profile
  /workspace
  /users
  /pipelines
  /tags
  /imports
```

## Entity detail layout

Use a repeatable structure:

### Header

- title/name
- status/stage
- owner
- important value
- primary actions
- overflow actions

### Main content

Left/center:
- overview
- timeline
- notes
- related activity

Right:
- key properties
- next task
- related records

On small screens the right rail moves below the main content.

## List page pattern

Every entity list should reuse:

1. page title + count
2. create button
3. search
4. filters
5. saved view selector
6. table/list
7. pagination
8. bulk actions when selected
9. empty state
10. error state
