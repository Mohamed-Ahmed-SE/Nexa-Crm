# 12 — Testing and Acceptance Criteria

## Testing layers

### Unit

Test:
- validation schemas
- business rules
- report calculations
- attention rules
- date logic
- permissions helpers

### Integration

Test:
- CRUD services
- lead conversion
- deal stage changes
- task completion
- role enforcement
- dashboard aggregates
- import validation

### E2E

Use Playwright or equivalent.

Critical journeys:

1. sign in
2. create lead
3. log activity
4. create task
5. convert lead
6. move deal stage
7. mark deal won
8. create contact/company
9. search
10. filter list
11. invite user if test environment supports it
12. permissions rejection
13. CSV import

## Product acceptance criteria

### Authentication

- unauthenticated user cannot access `/app/*`
- user can reset password
- disabled/deactivated workspace member cannot use workspace

### Leads

- can create/edit
- validation shown
- conversion produces expected records
- conversion is transaction-safe
- converted lead links to resulting records

### Contacts/Companies

- list/search/filter works
- detail page shows related data
- no cross-workspace data appears

### Deals

- board loads from DB
- stage drag persists
- failed drag rolls back
- stage change creates timeline event
- won/lost flow persists correctly

### Tasks

- complete action updates instantly
- overdue logic correct
- related entity links work

### Dashboard

- KPIs match underlying records
- clicking relevant stats navigates/filters correctly
- empty workspace does not show fake values

### Reports

- date range affects queries
- owner filter works
- no invented series points

### Permissions

- Viewer mutations denied server-side
- Member cannot administer users
- Admin can manage workspace/users
- Workspace A cannot access Workspace B

### Responsive

Test:
- 1440px
- 1024px
- 768px
- 390px

No required action may be inaccessible on mobile.

### Accessibility

- all forms labeled
- dialogs keyboard usable
- icon buttons have accessible names
- tab order logical
- focus visible

## Performance expectations

MVP should aim for:

- fast first useful render,
- paginated data lists,
- avoid loading all workspace rows,
- indexed common filters,
- no N+1 patterns,
- lazy-load heavy charts if useful,
- optimized avatars/images.

## Error handling

Test:

- network mutation failure
- database constraint error
- invalid URL/entity ID
- forbidden record
- deleted/archived related record
- CSV malformed file
- unsupported attachment type
