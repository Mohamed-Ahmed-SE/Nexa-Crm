export type CompanyDuplicateCandidate = { id: string; name: string; website: string | null };

export function normalizeCompanyName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function normalizeCompanyHostname(website: string | null): string {
  if (!website?.trim()) return "";
  const normalizedWebsite = website.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(normalizedWebsite) ? normalizedWebsite : `https://${normalizedWebsite}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }
}

export function findCompanyDuplicates(
  candidates: CompanyDuplicateCandidate[],
  name: string,
  website: string | null,
): CompanyDuplicateCandidate[] {
  const normalizedName = normalizeCompanyName(name);
  const normalizedHostname = normalizeCompanyHostname(website);
  return candidates.filter((candidate) => {
    const sameName = normalizedName !== "" && normalizeCompanyName(candidate.name) === normalizedName;
    const candidateHostname = normalizeCompanyHostname(candidate.website);
    const sameHostname = normalizedHostname !== "" && candidateHostname !== "" && candidateHostname === normalizedHostname;
    return sameName || sameHostname;
  });
}
