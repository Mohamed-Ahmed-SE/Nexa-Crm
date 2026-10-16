type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

export type AttachmentDeleteTarget = { workspaceId: string; entityType: "contact" | "company" | "deal" | "lead"; entityId: string; attachmentId: string };

/**
 * Removes one attachment's storage object and metadata row, scoped to the owning workspace and
 * entity. Looks the row up first so a missing or out-of-scope id reports "not found" rather than
 * attempting a delete; RLS and the storage policies enforce the same ownership rule independently.
 */
export async function deleteWorkspaceAttachment(
  supabase: Supabase,
  bucket: string,
  target: AttachmentDeleteTarget,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: attachment, error: lookupError } = await supabase.from("attachments").select("id, storage_path")
    .eq("workspace_id", target.workspaceId).eq("related_entity_type", target.entityType)
    .eq("related_entity_id", target.entityId).eq("id", target.attachmentId).maybeSingle();
  if (lookupError || !attachment) return { ok: false, message: "File not found. Refresh and try again." };
  const { error: storageError } = await supabase.storage.from(bucket).remove([attachment.storage_path]);
  if (storageError) return { ok: false, message: "Unable to delete this file. Try again." };
  const { data: deletedRow, error: deleteError } = await supabase.from("attachments").delete()
    .eq("workspace_id", target.workspaceId).eq("related_entity_type", target.entityType)
    .eq("related_entity_id", target.entityId).eq("id", target.attachmentId).select("id").maybeSingle();
  if (deleteError || !deletedRow) return { ok: false, message: "File was removed from storage, but its record could not be deleted. Contact support." };
  return { ok: true };
}
