import { notFound, redirect } from "next/navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { getContactDetail, listContactFormOptions } from "@/lib/contacts/repository";
import { contactIdSchema, contactPageSize, parseContactSearchParams } from "@/lib/contacts/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactDetailWorkspace } from "../contacts-workspace";

export default async function ContactDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("crm.view");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const validId = contactIdSchema.safeParse(id);
  if (!validId.success) notFound();
  const activityPage = query.view === "activity" ? parseContactSearchParams(query).page : 1;
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const [detail, options] = await Promise.all([
      getContactDetail(supabase, context.workspaceId, validId.data, activityPage),
      listContactFormOptions(supabase, context.workspaceId, context.userId, context.fullName),
    ]);
  if (!detail) notFound();
  const lastActivityPage = Math.max(1, Math.ceil(detail.activityCount / contactPageSize));
  if (query.view === "activity" && activityPage > lastActivityPage) redirect(`/app/contacts/${validId.data}?view=activity&page=${lastActivityPage}`);
  return <ContactDetailWorkspace
    activities={detail.activities}
    activityCount={detail.activityCount}
    activityPage={activityPage}
    attachments={detail.attachments}
    canEdit={hasWorkspacePermission(context.role, "crm.edit.all") || (hasWorkspacePermission(context.role, "crm.edit.own") && detail.contact.owner_id === context.userId)}
    canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
    companies={options.companies}
    company={detail.company}
    contact={detail.contact}
    deals={detail.deals}
    notes={detail.notes}
    owners={options.owners}
    tasks={detail.tasks}
    view={typeof query.view === "string" ? query.view : "overview"}
  />;
}
