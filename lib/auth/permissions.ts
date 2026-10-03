export const workspaceRoles = ["admin", "manager", "member", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const workspacePermissions = [
  "crm.view",
  "crm.create",
  "crm.edit.own",
  "crm.edit.all",
  "crm.archive",
  "crm.reassign",
  "reports.view",
  "users.invite",
  "users.manage",
  "pipeline.manage",
  "workspace.manage",
  "data.import",
  "data.export",
] as const;
export type WorkspacePermission = (typeof workspacePermissions)[number];

const rolePermissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  admin: workspacePermissions,
  manager: [
    "crm.view", "crm.create", "crm.edit.own", "crm.edit.all", "crm.archive", "crm.reassign",
    "reports.view", "data.import", "data.export",
  ],
  member: ["crm.view", "crm.create", "crm.edit.own", "reports.view"],
  viewer: ["crm.view", "reports.view"],
};

export function hasWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return rolePermissions[role].includes(permission);
}

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return workspaceRoles.some((workspaceRole) => workspaceRole === role);
}
