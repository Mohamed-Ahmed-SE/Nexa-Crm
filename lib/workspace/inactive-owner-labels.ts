import "server-only";

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

export class InactiveWorkspaceMemberLookupError extends Error {
  readonly code: string;

  constructor(code: unknown) {
    super("Unable to check workspace owner status.");
    this.name = "InactiveWorkspaceMemberLookupError";
    this.code = typeof code === "string" && code ? code : "unknown";
  }
}

export async function listInactiveWorkspaceMemberIds(supabase: Supabase, workspaceId: string, memberIds: Array<string | null | undefined>) {
  const targetMemberIds = [...new Set(memberIds.filter((id): id is string => Boolean(id)))];
  if (targetMemberIds.length === 0) return new Set<string>();

  const { data, error } = await supabase.rpc("list_inactive_workspace_member_ids", {
    target_workspace_id: workspaceId,
    target_member_ids: targetMemberIds,
  });
  if (error) throw new InactiveWorkspaceMemberLookupError(error.code);
  const inactiveMembers = (data ?? []) as Array<{ user_id: string }>;
  return new Set(inactiveMembers.map(({ user_id }) => user_id));
}

export function inactiveOwnerLabel(label: string) {
  return `${label} · Inactive user`;
}
