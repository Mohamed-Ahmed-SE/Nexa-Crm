# 07 — Data Model

Use UUID primary keys and timestamps with timezone.

Every business record belongs to a workspace.

## Core tables

### workspaces

- id
- name
- slug
- logo_url
- default_currency
- timezone
- created_at
- updated_at

### profiles

Maps authenticated user to application profile.

- id = auth user id
- full_name
- avatar_url
- phone
- job_title
- timezone
- created_at
- updated_at

### workspace_members

- id
- workspace_id
- user_id
- role
- status
- joined_at
- created_at

Unique: workspace_id + user_id

### workspace_invites

- id
- workspace_id
- email
- role
- token_hash or auth-compatible invite identifier
- invited_by
- expires_at
- accepted_at
- created_at

---

## leads

- id
- workspace_id
- full_name
- company_name
- email
- phone
- job_title
- source_id nullable
- status
- owner_id nullable
- estimated_value numeric
- currency
- notes_summary nullable
- converted_contact_id nullable
- converted_company_id nullable
- converted_deal_id nullable
- converted_at nullable
- created_by
- created_at
- updated_at
- archived_at nullable

Indexes:
- workspace_id
- owner_id
- status
- created_at
- lower(email) where email is not null

---

## contacts

- id
- workspace_id
- company_id nullable
- first_name
- last_name
- email
- phone
- job_title
- linkedin_url
- owner_id nullable
- lifecycle_status
- created_by
- created_at
- updated_at
- archived_at

---

## companies

- id
- workspace_id
- name
- website
- industry
- employee_size
- phone
- address_line_1
- address_line_2
- city
- state
- postal_code
- country
- description
- owner_id nullable
- created_by
- created_at
- updated_at
- archived_at

---

## pipelines

- id
- workspace_id
- name
- is_default
- created_at
- updated_at

## pipeline_stages

- id
- workspace_id
- pipeline_id
- name
- position integer
- probability integer 0..100
- stage_type enum(open, won, lost)
- color_token
- is_active
- created_at
- updated_at

Constraint:
- one Won and one Lost terminal stage per pipeline recommended.

---

## deals

- id
- workspace_id
- pipeline_id
- stage_id
- title
- company_id nullable
- primary_contact_id nullable
- amount numeric
- currency
- probability
- expected_close_date
- owner_id nullable
- source_id nullable
- priority enum(low, medium, high)
- description
- status enum(open, won, lost)
- won_at nullable
- lost_at nullable
- lost_reason_id nullable
- lost_reason_text nullable
- created_by
- created_at
- updated_at
- archived_at

---

## tasks

- id
- workspace_id
- title
- description
- task_type
- status enum(open, completed, cancelled)
- priority
- due_at
- assigned_to
- created_by
- related_entity_type nullable
- related_entity_id nullable
- reminder_at nullable
- completed_at nullable
- created_at
- updated_at

Polymorphic relation must be validated at application layer or replaced with explicit relation tables if preferred.

---

## activities

- id
- workspace_id
- activity_type
- subject
- body
- occurred_at
- created_by
- owner_id nullable
- related_entity_type
- related_entity_id
- metadata jsonb
- is_system_event boolean
- created_at
- updated_at

System event examples:

```json
{
  "from_stage_id": "...",
  "to_stage_id": "..."
}
```

---

## notes

- id
- workspace_id
- body
- is_pinned
- created_by
- related_entity_type
- related_entity_id
- created_at
- updated_at

---

## attachments

- id
- workspace_id
- storage_path
- filename
- mime_type
- size_bytes
- uploaded_by
- related_entity_type
- related_entity_id
- created_at

---

## tags

- id
- workspace_id
- name
- color_token
- created_at

Unique: workspace_id + lower(name)

## entity_tags

- id
- workspace_id
- tag_id
- entity_type
- entity_id

Unique:
- tag_id + entity_type + entity_id

---

## lead_sources

- id
- workspace_id
- name
- is_active
- created_at

Seed:
- Website
- Referral
- LinkedIn
- Outbound
- Event
- Partner
- Other

---

## lost_reasons

- id
- workspace_id
- name
- is_active
- created_at

Seed:
- Price
- Timing
- No response
- Competitor
- Not a fit
- Budget unavailable
- Other

---

## notifications

- id
- workspace_id
- user_id
- type
- title
- body
- href
- read_at
- created_at

---

## saved_views

- id
- workspace_id
- user_id
- entity_type
- name
- filters jsonb
- sort jsonb
- visible_columns jsonb
- created_at
- updated_at

---

## import_jobs

- id
- workspace_id
- entity_type
- filename
- status
- total_rows
- imported_rows
- skipped_rows
- error_rows
- mapping jsonb
- error_report_path nullable
- created_by
- created_at
- completed_at

---

## audit_events

- id
- workspace_id
- actor_user_id nullable
- event_type
- entity_type
- entity_id
- metadata jsonb
- created_at

Append-only.

---

# Relationship summary

```text
Workspace
 ├─ Members
 ├─ Leads
 ├─ Contacts ── Company
 ├─ Companies
 ├─ Pipelines ── Stages
 ├─ Deals ── Company / Contact / Stage
 ├─ Tasks
 ├─ Activities
 ├─ Notes
 ├─ Tags
 ├─ Notifications
 └─ Audit Events
```

# Data ownership rule

`workspace_id` must never come directly from an untrusted client payload as an authority decision.

Resolve allowed workspace membership server-side and enforce it in the database.
