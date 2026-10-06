export function isRetainingRelation(nextId: string | null, currentId: string | null): boolean {
  return nextId !== null && nextId === currentId;
}

export function contactCanBeEdited(canEditAll: boolean, ownerId: string | null, userId: string): boolean {
  return canEditAll || ownerId === userId;
}

export function canRetainArchivedCompany(nextCompanyId: string | null, currentCompanyId: string | null): boolean {
  return isRetainingRelation(nextCompanyId, currentCompanyId);
}
