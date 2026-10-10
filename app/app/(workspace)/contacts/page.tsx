import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { listContactSavedViews, listWorkspaceContacts } from "@/lib/contacts/repository";
import { applyContactSavedView, contactSavedViewIdSchema, contactViewColumns, parseContactSearchParams } from "@/lib/contacts/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactsWorkspace } from "./contacts-workspace";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const rawParams = await searchParams;
  const params = parseContactSearchParams(rawParams);
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const savedViews = await listContactSavedViews(supabase, context.workspaceId, context.userId);
  const requestedView = contactSavedViewIdSchema.safeParse(rawParams.view);
  const activeView = requestedView.success ? savedViews.find((view) => view.id === requestedView.data) : undefined;
  const activeParams = activeView ? applyContactSavedView(params, activeView) : params;
  const visibleColumns = activeView?.visibleColumns ?? [...contactViewColumns];
  const contactsPage = await listWorkspaceContacts(supabase, context.workspaceId, context.userId, context.fullName, activeParams);
  return <ContactsWorkspace
      activeCount={contactsPage.activeCount}
      canCreate={canCreate}
      canImport={hasWorkspacePermission(context.role, "data.import")}
      canExport={hasWorkspacePermission(context.role, "data.export")}
      createIntent={canCreate && rawParams.create === "1"}
      canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")}
      canEditOwn={hasWorkspacePermission(context.role, "crm.edit.own")}
      canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
      companyId={activeParams.companyId}
      companies={contactsPage.companies}
      contacts={contactsPage.contacts}
      currentUserId={context.userId}
      customerCount={contactsPage.customerCount}
      lifecycle={activeParams.lifecycle}
      matchedCount={contactsPage.matchedCount}
      ownerId={activeParams.ownerId}
      owners={contactsPage.owners}
      page={activeParams.page}
      search={activeParams.q}
      sort={activeParams.sort}
      visibleColumns={visibleColumns}
      savedViews={savedViews}
      activeViewId={activeView?.id ?? ""}
      totalCount={contactsPage.totalCount}
  />;
}
