import { describe, expect, it } from "vitest";
import { deriveWorkspaceContext, selectActiveWorkspace } from "@/lib/auth/workspace-context";

const user = { id: "user-1", email: "alex@example.com" };
const member = { user_id: "user-1", workspace_id: "workspace-1", role: "admin", status: "active" };
const workspace = { id: "workspace-1", name: "Acme" };

describe("server-derived workspace context", () => {
  it("derives identity and role from the matching active membership", () => {
    expect(deriveWorkspaceContext(user, member, workspace, { full_name: " Alex Chen ", date_format: null, avatar_url: "https://images.example.com/alex.png" })).toEqual({
      userId: "user-1",
      email: "alex@example.com",
      fullName: "Alex Chen",
      workspaceId: "workspace-1",
      workspaceName: "Acme",
      role: "admin",
      dateFormat: "MM/DD/YYYY",
      avatarUrl: "https://images.example.com/alex.png",
      workspaces: [workspace],
    });
  });

  it("selects the requested active workspace and derives its own membership role", () => {
    const memberships = [
      member,
      { ...member, workspace_id: "workspace-2", role: "viewer" },
      { ...member, workspace_id: "workspace-3", status: "deactivated" },
    ];
    const workspaces = [workspace, { id: "workspace-2", name: "Northwind" }, { id: "workspace-3", name: "Inactive" }];
    const selected = selectActiveWorkspace(user.id, memberships, workspaces, "workspace-2");

    expect(selected).toEqual({ membership: memberships[1], workspace: workspaces[1] });
    expect(deriveWorkspaceContext(user, selected?.membership ?? null, selected?.workspace ?? null, null)?.role)
      .toBe("viewer");
  });

  it("falls back to the first active membership when a persisted workspace is stale", () => {
    const memberships = [member, { ...member, workspace_id: "workspace-2", status: "deactivated" }];
    const workspaces = [workspace, { id: "workspace-2", name: "Inactive" }];

    expect(selectActiveWorkspace(user.id, memberships, workspaces, "workspace-2"))
      .toEqual({ membership: member, workspace });
    expect(selectActiveWorkspace(user.id, memberships, workspaces, "forged-workspace"))
      .toEqual({ membership: member, workspace });
  });

  it.each([
    [{ ...member, user_id: "another-user" }, workspace],
    [{ ...member, status: "deactivated" }, workspace],
    [{ ...member, role: "owner" }, workspace],
    [member, { id: "other-workspace", name: "Other" }],
  ])("rejects a mismatched, inactive, unknown-role, or cross-workspace membership", (membership, relatedWorkspace) => {
    expect(deriveWorkspaceContext(user, membership, relatedWorkspace, null)).toBeNull();
  });
});
