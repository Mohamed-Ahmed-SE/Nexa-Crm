# 10 — Business Rules

## Deal status

Deal status is derived/kept consistent with stage type.

- stage_type=open => deal status=open
- stage_type=won => deal status=won
- stage_type=lost => deal status=lost

Do not allow impossible combinations.

## Deal probability

Each open stage has a default probability.

When deal enters a stage:
- update probability to stage default unless the user explicitly overrides probability and product design chooses to preserve custom value.

For MVP, simplest rule:
**stage move updates probability to stage default.**

Won = 100  
Lost = 0

## Deal attention rules

A deal may need attention if:

- status=open and expected close date < today
- status=open and no open future task
- status=open and no activity in last 14 days

Do not mark newly created deals stale immediately.

Suggested:
- stale check only after 14 days from creation or last activity.

## Lead stale rule

Lead is stale if:
- New/Contacted/Qualified
- no activity for 14 days
- not converted/unqualified

## Task overdue

Task is overdue if:

```text
status = open AND due_at < now
```

## Lead conversion

After conversion:
- status = Converted
- original record retained
- converted record IDs stored
- editing core lead state should be restricted
- timeline preserved

## Duplicate detection

Warn, do not necessarily block.

Contacts:
- exact normalized email
- exact normalized phone

Companies:
- normalized name + website/domain signal

Leads:
- normalized email/phone

## Currency

Workspace has default currency.

MVP may assume one active currency per workspace for aggregate dashboard values.

If deal currency differs, exclude or avoid aggregation unless conversion exists.

Recommended MVP:
Use workspace default currency for all monetary CRM values.

## Closing this month

Open deals where expected close date is within current calendar month.

## Won revenue this month

Deals marked won where won_at occurs in current month.

## Pipeline value

Sum amount for open deals.

## Stage conversion / funnel

Count deals that reached relevant stages within report scope.

If precise historical stage analytics are required, compute from audit/activity stage-change events.

## Win rate

For a selected period:

```text
won deals / (won deals + lost deals)
```

Do not include currently open deals.

## Deactivated users

- remain visible historically
- cannot sign in through membership
- ownership is preserved until records are reassigned
- UI should surface "Inactive user" marker

## Pipeline stage deletion

Do not delete a stage with active deals.

Admin must first:
- move those deals,
- or choose destination stage.

Prefer soft-disable where possible.
