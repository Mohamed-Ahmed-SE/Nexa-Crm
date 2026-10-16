import "server-only";

export type EntityTagType = "company" | "contact" | "lead" | "deal";
export type EntityTag = { id: string; name: string; color_token: string | null };

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>>;

/**
 * Loads the tags attached to each of the given entity IDs within a workspace, scoped to one entity type.
 * Returns a map from entity ID to its tags; entities without tags are omitted from the map.
 */
export async function listEntityTags(
  supabase: Supabase,
  workspaceId: string,
  entityType: EntityTagType,
  entityIds: string[],
): Promise<Map<string, EntityTag[]>> {
  const tagsByEntity = new Map<string, EntityTag[]>();
  if (!entityIds.length) return tagsByEntity;
  const { data: links, error: linksError } = await supabase.from("entity_tags").select("entity_id, tag_id")
    .eq("workspace_id", workspaceId).eq("entity_type", entityType).in("entity_id", entityIds);
  if (linksError) throw new Error("Unable to load tags.");
  const tagIds = [...new Set((links ?? []).map(({ tag_id }: { tag_id: string }) => tag_id))];
  if (!tagIds.length) return tagsByEntity;
  const { data: tags, error: tagsError } = await supabase.from("tags").select("id, name, color_token")
    .eq("workspace_id", workspaceId).in("id", tagIds);
  if (tagsError) throw new Error("Unable to load tags.");
  const tagsById = new Map(((tags ?? []) as EntityTag[]).map((tag) => [tag.id, tag]));
  for (const link of (links ?? []) as Array<{ entity_id: string; tag_id: string }>) {
    const tag = tagsById.get(link.tag_id);
    if (tag) tagsByEntity.set(link.entity_id, [...(tagsByEntity.get(link.entity_id) ?? []), tag]);
  }
  return tagsByEntity;
}

/**
 * Replaces the full set of tags associated with one entity within a workspace, scoped to one entity type.
 * Computes additions and removals against the current associations and applies only the difference.
 * Returns true when the replacement fully succeeded, attempting to roll back partial changes otherwise.
 */
export async function replaceEntityTags(
  supabase: Supabase,
  workspaceId: string,
  entityType: EntityTagType,
  entityId: string,
  tagIds: string[],
): Promise<boolean> {
  const { data: currentLinks, error: readError } = await supabase.from("entity_tags").select("tag_id")
    .eq("workspace_id", workspaceId).eq("entity_type", entityType).eq("entity_id", entityId);
  if (readError) return false;
  const currentIds = new Set((currentLinks ?? []).map(({ tag_id }: { tag_id: string }) => tag_id));
  const nextIds = new Set(tagIds);
  const additions = tagIds.filter((tagId) => !currentIds.has(tagId));
  const removals = [...currentIds].filter((tagId) => !nextIds.has(tagId));
  if (additions.length) {
    const { data: inserted, error } = await supabase.from("entity_tags")
      .insert(additions.map((tag_id) => ({ workspace_id: workspaceId, entity_type: entityType, entity_id: entityId, tag_id }))).select("tag_id");
    if (error || inserted?.length !== additions.length) {
      if (inserted?.length) await supabase.from("entity_tags").delete().eq("workspace_id", workspaceId).eq("entity_type", entityType).eq("entity_id", entityId).in("tag_id", inserted.map(({ tag_id }: { tag_id: string }) => tag_id));
      return false;
    }
  }
  if (removals.length) {
    const { error } = await supabase.from("entity_tags").delete().eq("workspace_id", workspaceId).eq("entity_type", entityType).eq("entity_id", entityId).in("tag_id", removals);
    if (error) {
      if (additions.length) await supabase.from("entity_tags").delete().eq("workspace_id", workspaceId).eq("entity_type", entityType).eq("entity_id", entityId).in("tag_id", additions);
      return false;
    }
  }
  return true;
}

/** Loads every tag defined in a workspace, ordered by name. */
export async function listWorkspaceTags(supabase: Supabase, workspaceId: string): Promise<EntityTag[]> {
  const { data, error } = await supabase.from("tags").select("id, name, color_token").eq("workspace_id", workspaceId).order("name");
  if (error) throw new Error("Unable to load workspace tags.");
  return (data ?? []) as EntityTag[];
}

/** Verifies that every given tag ID exists within the workspace. Returns true for an empty list. */
export async function verifyWorkspaceTagIds(supabase: Supabase, workspaceId: string, tagIds: string[]): Promise<boolean> {
  if (!tagIds.length) return true;
  const { data, error } = await supabase.from("tags").select("id").eq("workspace_id", workspaceId).in("id", tagIds);
  const verifiedIds = new Set(((data ?? []) as Array<{ id: string }>).map(({ id }) => id));
  return !error && verifiedIds.size === tagIds.length && tagIds.every((tagId) => verifiedIds.has(tagId));
}
