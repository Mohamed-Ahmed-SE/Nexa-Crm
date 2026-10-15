import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorize";
import { dealIdSchema } from "@/lib/deals/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const context = await requirePermission("crm.view");
  const { fileId } = await params;
  const parsedId = dealIdSchema.safeParse(fileId);
  if (!parsedId.success) return new Response("File not found.", { status: 404 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Authentication is not configured.", { status: 503 });
  const { data: attachment, error } = await supabase.from("attachments").select("storage_path, filename")
    .eq("workspace_id", context.workspaceId).eq("id", parsedId.data).eq("related_entity_type", "deal").maybeSingle();
  if (error || !attachment) return new Response("File not found in this workspace deal.", { status: 404 });
  const { data: signedUrlResult, error: storageError } = await supabase.storage.from("deal-attachments")
    .createSignedUrl(attachment.storage_path, 60, { download: attachment.filename });
  if (storageError || !signedUrlResult?.signedUrl) return new Response("File could not be downloaded.", { status: 404 });
  return NextResponse.redirect(signedUrlResult.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
