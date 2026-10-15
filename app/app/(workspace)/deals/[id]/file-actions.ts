"use server";

import { revalidatePath } from "next/cache";
import { hasWorkspacePermission, type WorkspaceRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { dealIdSchema } from "@/lib/deals/schema";
import { isValidDealUploadContent, validateDealUploadMetadata } from "@/lib/deals/upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DealFileActionState = { ok?: boolean; message?: string };
type DealUploadSupabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type DealUploadInput = { workspaceId: string; userId: string; role: WorkspaceRole; dealId: string };
type DealAttachmentUpload = DealUploadInput & { filename: string; mimeType: string; bytes: Uint8Array };

const formText = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
};

async function canUploadDeal(supabase: DealUploadSupabase, input: DealUploadInput) {
  const { data: deal, error } = await supabase.from("deals").select("id, owner_id")
    .eq("workspace_id", input.workspaceId).eq("id", input.dealId).is("archived_at", null).maybeSingle();
  if (error || !deal) return { message: "Deal not found in this workspace." };
  if (!hasWorkspacePermission(input.role, "crm.edit.all") && deal.owner_id !== input.userId) {
    return { message: "You can upload files only to deals assigned to you." };
  }
  return null;
}

async function removeFailedDealAttachment(supabase: DealUploadSupabase, workspaceId: string, fileId: string) {
  const { error } = await supabase.from("attachments").delete().eq("workspace_id", workspaceId).eq("id", fileId);
  return error;
}

async function persistDealAttachment(supabase: DealUploadSupabase, input: DealAttachmentUpload): Promise<DealFileActionState> {
  const fileId = crypto.randomUUID();
  const storagePath = `${input.workspaceId}/${input.dealId}/${fileId}/${input.filename}`;
  const { error: recordError } = await supabase.from("attachments").insert({
    id: fileId, workspace_id: input.workspaceId, storage_path: storagePath, filename: input.filename,
    mime_type: input.mimeType, size_bytes: input.bytes.byteLength, uploaded_by: input.userId,
    related_entity_type: "deal", related_entity_id: input.dealId,
  });
  if (recordError) return { message: "Unable to save file details." };
  const { error: uploadError } = await supabase.storage.from("deal-attachments").upload(storagePath, input.bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) return await removeFailedDealAttachment(supabase, input.workspaceId, fileId)
    ? { message: "Upload failed and file details could not be cleaned up. Contact support." }
    : { message: "Unable to upload this file." };
  revalidatePath(`/app/deals/${input.dealId}`);
  return { ok: true, message: "File uploaded." };
}

export async function uploadDealFileAction(_previous: DealFileActionState, form: FormData): Promise<DealFileActionState> {
  const dealId = dealIdSchema.safeParse(formText(form, "dealId"));
  const file = form.get("file");
  if (!dealId.success || !(file instanceof File)) return { message: "Choose a file to upload." };
  const metadata = validateDealUploadMetadata(file);
  if ("message" in metadata) return metadata;

  const context = await requirePermission("crm.edit.own");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Authentication is not configured." };
  const input = { workspaceId: context.workspaceId, userId: context.userId, role: context.role, dealId: dealId.data };
  const accessError = await canUploadDeal(supabase, input);
  if (accessError) return accessError;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidDealUploadContent(bytes, metadata.mimeType, file.size)) return { message: "The file content does not match its declared type." };
  return persistDealAttachment(supabase, { ...input, ...metadata, bytes });
}
