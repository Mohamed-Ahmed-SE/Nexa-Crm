export type TaskOwner = { id: string; label: string };

export function formatTaskOwners(members: Array<{ user_id: string }>, currentUserId: string): TaskOwner[] {
  return members.map(({ user_id }) => ({
    id: user_id,
    label: user_id === currentUserId ? "You" : `Workspace member · ${user_id.slice(0, 6)}`,
  }));
}
