import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/authorize";
import { listWorkspaceContacts } from "@/lib/contacts/repository";
import { parseContactSearchParams } from "@/lib/contacts/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactsWorkspace } from "./contacts-workspace";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requirePermission("crm.view");
  const rawParams = await searchParams;
  const params = parseContactSearchParams(rawParams);
  const canCreate = hasWorkspacePermission(context.role, "crm.create");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");
  const contactsPage = await listWorkspaceContacts(supabase, context.workspaceId, context.userId, context.fullName, params);
  return <ContactsWorkspace
      activeCount={contactsPage.activeCount}
      canCreate={canCreate}
      canImport={hasWorkspacePermission(context.role, "data.import")}
      canExport={hasWorkspacePermission(context.role, "data.export")}
      createIntent={canCreate && rawParams.create === "1"}
      canEditAll={hasWorkspacePermission(context.role, "crm.edit.all")}
      canEditOwn={hasWorkspacePermission(context.role, "crm.edit.own")}
      canReassign={hasWorkspacePermission(context.role, "crm.reassign")}
      companyId={params.companyId}
      companies={contactsPage.companies}
      contacts={contactsPage.contacts}
      currentUserId={context.userId}
      customerCount={contactsPage.customerCount}
      lifecycle={params.lifecycle}
      matchedCount={contactsPage.matchedCount}
      ownerId={params.ownerId}
      owners={contactsPage.owners}
      page={params.page}
      search={params.q}
      totalCount={contactsPage.totalCount}
  />;
}
