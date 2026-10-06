# 09 — API / Server Action Contracts

Use a service layer even if framework Server Actions are used.

UI components should not contain raw database logic.

Suggested layers:

```text
UI
 -> action/controller
 -> authorization + validation
 -> service
 -> repository/database
```

## Shared response pattern

Success:

```ts
type ActionSuccess<T> = {
  ok: true
  data: T
}
```

Failure:

```ts
type ActionError = {
  ok: false
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
  }
}
```

## Leads

### createLead(input)

Input:
- fullName
- companyName?
- email?
- phone?
- jobTitle?
- sourceId?
- ownerId?
- estimatedValue?
- tags?

Output:
- lead

### updateLead(id, input)

### archiveLead(id)

### convertLead(id, input)

Input:

```ts
{
  createContact: boolean
  createCompany: boolean
  createDeal: boolean
  contact?: {...}
  company?: {...}
  deal?: {
    title: string
    pipelineId: string
    stageId: string
    amount?: number
    expectedCloseDate?: string
    ownerId?: string
  }
}
```

Must be transactional.

---

## Contacts

- createContact
- updateContact
- archiveContact
- getContact
- listContacts

---

## Companies

- createCompany
- updateCompany
- archiveCompany
- getCompany
- listCompanies

---

## Deals

- createDeal
- updateDeal
- moveDealStage
- markDealWon
- markDealLost
- reopenDeal
- archiveDeal
- listDeals
- getDeal

### moveDealStage

Input:
- dealId
- destinationStageId

Behavior:
- verify same pipeline/workspace
- update status based on stage type
- create activity/audit event
- return updated deal

---

## Tasks

- createTask
- updateTask
- completeTask
- cancelTask
- reopenTask
- listTasks

Completing a task:
- sets status completed
- sets completed_at
- logs activity when related to entity

---

## Activities

- logCall
- logEmail
- logMeeting
- addManualActivity
- listEntityTimeline

---

## Notes

- createNote
- updateNote
- deleteNote
- togglePinned

---

## Tags

- createTag
- addTagToEntity
- removeTagFromEntity
- listTags

---

## Search

`globalSearch(query, limitPerType)`

Return:

```ts
{
  leads: [],
  contacts: [],
  companies: [],
  deals: []
}
```

Minimum input length can be 2 characters.

---

## Dashboard

`getDashboardSummary(filters)`

Return:

```ts
{
  metrics: {
    openPipelineValue: number
    closingThisMonthValue: number
    wonThisMonthValue: number
    newLeadsThisMonth: number
    overdueTasks: number
  }
  pipelineByStage: []
  revenueTrend: []
  dueTasks: []
  attentionDeals: []
  recentActivity: []
}
```

---

## Reports

Each report must be computed from actual CRM data.

- getPipelineReport
- getRevenueReport
- getLeadSourceReport
- getActivityReport
- getTaskReport

---

## Imports

- createImportJob
- previewCsvMapping
- validateImport
- executeImport
- getImportStatus
- downloadImportErrors

---

## User management

- inviteWorkspaceMember
- changeMemberRole
- deactivateMember
- reactivateMember
- listWorkspaceMembers

Admin only except list if wider access is desired.
