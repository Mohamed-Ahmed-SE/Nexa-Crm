import { describe, expect, it } from "vitest";
import { deriveWorkspaceContext } from "@/lib/auth/workspace-context";

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
    });
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
