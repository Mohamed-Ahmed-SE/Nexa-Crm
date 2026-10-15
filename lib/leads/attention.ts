const staleAfterMs = 14 * 86_400_000;

type LeadAttentionCandidate = {
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  createdAt: string;
};
type LeadAttention = {
  lead: LeadAttentionCandidate;
  latestActivityAt: string | null;
  now: Date;
};

export function isStaleLead({ lead, latestActivityAt, now }: LeadAttention): boolean {
  if (lead.status !== "new" && lead.status !== "contacted" && lead.status !== "qualified") return false;
  const activityBaseline = latestActivityAt ?? lead.createdAt;
  return now.valueOf() - Date.parse(activityBaseline) >= staleAfterMs;
}
