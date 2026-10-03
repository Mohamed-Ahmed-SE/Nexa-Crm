import { describe, expect, it } from "vitest";
import { hasWorkspacePermission, type WorkspacePermission, type WorkspaceRole } from "@/lib/auth/permissions";

describe("workspace permissions", () => {
  it.each([
    ["admin", "users.manage", true],
    ["admin", "workspace.manage", true],
    ["manager", "crm.edit.all", true],
    ["manager", "users.invite", false],
    ["member", "crm.create", true],
    ["member", "crm.edit.all", false],
    ["member", "data.export", false],
    ["viewer", "crm.view", true],
    ["viewer", "crm.create", false],
    ["viewer", "users.manage", false],
  ] satisfies [WorkspaceRole, WorkspacePermission, boolean][]) (
    "%s role permission %s is %s",
    (role, permission, allowed) => {
      expect(hasWorkspacePermission(role, permission)).toBe(allowed);
    },
  );
});
