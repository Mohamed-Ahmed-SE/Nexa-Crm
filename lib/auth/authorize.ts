import "server-only";

import { notFound, redirect } from "next/navigation";
import { hasWorkspacePermission, type WorkspacePermission } from "@/lib/auth/permissions";
import { getWorkspaceContext } from "@/lib/auth/context";

export async function requirePermission(permission: WorkspacePermission) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/auth/sign-in");
  if (!hasWorkspacePermission(context.role, permission)) notFound();
  return context;
}
