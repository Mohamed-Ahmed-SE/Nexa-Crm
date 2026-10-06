# 18 — Form and Modal Specification

Forms must visually match the approved Nexa CRM references:
compact, structured, white surface, thin borders, clear labels.

---

# General Form Rules

- labels stay visible
- required fields marked consistently
- help text is concise
- field errors appear below the field
- server error does not wipe entered values
- submit button shows loading
- successful create closes sheet/modal and updates the relevant view
- `Esc` closes only when doing so will not lose important unsaved work without warning

Create forms should usually use a right-side sheet/drawer on desktop.

Complex edit screens may use modal or full detail page.

---

# Add Lead

Fields:

Required:
- Full Name

Optional:
- Company Name
- Email
- Phone
- Job Title
- Source
- Status
- Owner
- Estimated Value
- Tags
- Notes

Footer:
- Cancel
- Add Lead

After create:
- toast
- table updates
- optional `Open Lead` action

---

# Convert Lead

Modal title:
`Convert Lead`

Sections:
- Create Contact toggle
- Create Company toggle
- Create Deal toggle

If Create Deal:
- Deal Name
- Pipeline
- Stage
- Value
- Expected Close
- Owner

Primary:
`Convert`

Must be transactional.

---

# Add Contact

- First Name
- Last Name
- Email
- Phone
- Job Title
- Company
- Owner
- Lifecycle
- Tags
- LinkedIn URL
- Notes

Duplicate warning:
- show non-blocking alert for matching email/phone

---

# Add Company

- Company Name
- Website
- Industry
- Employee Size
- Phone
- Address
- Owner
- Tags
- Description

---

# Add Deal

- Deal Title
- Company
- Primary Contact
- Pipeline
- Stage
- Amount
- Expected Close Date
- Owner
- Source
- Priority
- Tags
- Description

Stage default should follow selected pipeline.

---

# Log Activity

Compact modal/sheet.

Activity type:
- Call
- Email
- Meeting
- Note

Fields:
- Subject
- Description
- Occurred At
- Related Record auto-filled from context

Optional:
- Create follow-up task

This is a high-frequency action.
Optimize for speed.

---

# Add Task

Fields:
- Task Title
- Type
- Due Date / Time
- Assignee
- Priority
- Related To
- Description
- Reminder

Buttons:
- Cancel
- Add Task

---

# Mark Deal Won

Dialog:
- Final Amount
- Won Date
- Closing Note optional

Primary:
`Mark Won`

Use green semantic action.

---

# Mark Deal Lost

Dialog:
- Lost Reason required
- Competitor optional
- Closing Note optional

Primary:
`Mark Lost`

Use destructive/soft-red action.

---

# Edit Pipeline

Settings screen or modal.

Fields:
- Pipeline Name
- Stage list

Stage row:
- drag handle
- Name
- Probability
- Color
- Type
- Active state

Won/Lost stage restrictions apply.

---

# Invite Team Member

Fields:
- Email
- Role

Primary:
`Send Invite`

Show pending invite row after success.

---

# CSV Import

Do not use one giant modal.

Use multi-step page or large contained flow.

1. Upload
2. Mapping
3. Preview
4. Validation
5. Confirm
6. Result

Mapping rows:
CSV Column -> CRM Field

Invalid records clearly display row + field + reason.
