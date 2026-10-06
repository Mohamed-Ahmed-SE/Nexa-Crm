export function getOwnerInitials(ownerName: string): string {
  const [firstName, ...remainingNames] = ownerName.trim().split(/\s+/).filter(Boolean);
  if (!firstName) return "?";
  const lastName = remainingNames.at(-1);
  return lastName
    ? `${Array.from(firstName)[0]}${Array.from(lastName)[0]}`.toUpperCase()
    : Array.from(firstName).slice(0, 2).join("").toUpperCase();
}

export function isDealOverdue(
  status: "open" | "won" | "lost",
  expectedCloseDate: string | null,
  todayIso: string,
): boolean {
  return status === "open" && expectedCloseDate !== null && expectedCloseDate < todayIso;
}
