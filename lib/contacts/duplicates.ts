export type ContactDuplicate = { name: string; companyName: string | null };

export type ContactDuplicateCandidate = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  companies: { name: string } | { name: string }[] | null;
};

export function normalizeContactEmail(email: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeContactPhone(phone: string | null): string {
  return phone?.replace(/\D/g, "") ?? "";
}

export function findContactDuplicates(
  candidates: ContactDuplicateCandidate[],
  email: string,
  phone: string,
): ContactDuplicate[] {
  return candidates
    .filter((candidate) => {
      const emailMatches = email !== "" && normalizeContactEmail(candidate.email) === email;
      const phoneMatches = phone !== "" && normalizeContactPhone(candidate.phone) === phone;
      return emailMatches || phoneMatches;
    })
    .map((candidate) => ({
      name: `${candidate.first_name} ${candidate.last_name}`.trim(),
      companyName: (Array.isArray(candidate.companies) ? candidate.companies[0] : candidate.companies)?.name ?? null,
    }));
}
