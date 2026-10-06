export function isRetainingRelation(submittedId: string | null, currentId: string | null): boolean {
  return currentId !== null && submittedId === currentId;
}

export function needsRetainedRelationOption(currentId: string | null, selectableIds: readonly string[]): boolean {
  return currentId !== null && !selectableIds.includes(currentId);
}
