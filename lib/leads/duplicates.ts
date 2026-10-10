export type LeadDuplicateCandidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type LeadDuplicateMatch = Pick<LeadDuplicateCandidate, "id" | "full_name" | "email" | "phone">;

export function normalizeLeadEmail(email: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeLeadPhone(phone: string | null): string {
  return phone?.replace(/\D/g, "") ?? "";
}

export function findLeadDuplicates(
  candidates: LeadDuplicateCandidate[],
  email: string,
  phone: string,
): LeadDuplicateMatch[] {
  return candidates.filter((candidate) => {
    const emailMatches = email !== "" && normalizeLeadEmail(candidate.email) === email;
    const phoneMatches = phone !== "" && normalizeLeadPhone(candidate.phone) === phone;
    return emailMatches || phoneMatches;
  });
}
