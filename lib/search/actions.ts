"use server";

import { requirePermission } from "@/lib/auth/authorize";
import { emptyGlobalSearchResults, parseGlobalSearchInput } from "@/lib/search/global-search";
import { searchWorkspaceRecords } from "@/lib/search/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function globalSearchAction(input: unknown) {
  const context = await requirePermission("crm.view");
  const query = parseGlobalSearchInput(input);
  if (!query) return { ok: true as const, results: emptyGlobalSearchResults() };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, message: "Search is unavailable. Please try again." };
  try {
    return { ok: true as const, results: await searchWorkspaceRecords(supabase, context.workspaceId, query) };
  } catch {
    return { ok: false as const, message: "Search could not be completed. Please try again." };
  }
}
