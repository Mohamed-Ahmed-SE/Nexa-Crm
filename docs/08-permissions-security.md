# 08 — Permissions and Security

## Roles

MVP roles:

- Admin
- Manager
- Member
- Viewer

## Permission matrix

| Capability | Admin | Manager | Member | Viewer |
|---|---:|---:|---:|---:|
| View CRM data | Yes | Yes | Yes | Yes |
| Create CRM records | Yes | Yes | Yes | No |
| Edit own/assigned records | Yes | Yes | Yes | No |
| Edit all records | Yes | Yes | Limited | No |
| Delete/archive records | Yes | Yes | Limited | No |
| Reassign ownership | Yes | Yes | Limited | No |
| View reports | Yes | Yes | Yes | Yes |
| Invite users | Yes | No | No | No |
| Change roles | Yes | No | No | No |
| Manage pipeline | Yes | No | No | No |
| Workspace settings | Yes | No | No | No |
| Import data | Yes | Yes | Optional | No |
| Export data | Yes | Yes | Optional | No |

Exact "Limited" behavior may initially mean records owned by the member plus globally readable records within the workspace.

## Security requirements

### Database

- RLS enabled on every exposed business table.
- Every query constrained by workspace membership.
- Service role keys never exposed to browser.
- Storage policies follow workspace/entity access.
- Audit events are append-only to normal members.

### Server

- Validate all inputs with schemas.
- Never trust role or workspace passed from client.
- Enforce permission checks server-side.
- Rate-limit sensitive auth/invite/import endpoints where appropriate.
- Sanitize filenames.
- Validate file type and size.
- Prevent open redirects.
- Use secure auth cookie/session patterns from framework/provider guidance.

### UI

Hidden UI is not authorization.

If a Member cannot manage users:
- hide Settings > Users management actions,
- but server/database must also reject the operation.

## Record deletion

Prefer archive/soft-delete for CRM records.

Hard deletion may be admin-only and optional.

## Invite safety

- invitation expires,
- invitation must belong to a workspace,
- acceptance links should not expose reusable plain secrets in storage,
- user cannot accept for a different email unless explicitly supported.

## Activity/audit integrity

System events such as:
- "Deal marked won"
- "Owner changed"
- "Stage changed"

should not be editable from normal UI.

## Sensitive fields

Do not log:
- passwords,
- access tokens,
- auth cookies,
- private service keys.

## Cross-workspace isolation

This is a release blocker.

A user from Workspace A must never be able to:
- read,
- update,
- delete,
- search,
- export,
- attach files to

records from Workspace B.
