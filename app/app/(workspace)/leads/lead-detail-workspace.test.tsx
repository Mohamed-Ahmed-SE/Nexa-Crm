import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LeadDetail } from "@/lib/leads/repository";
import { LeadDetailWorkspace } from "./lead-detail-workspace";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href as string} {...props}>{children}</a> }));

const detail: LeadDetail = {
  lead: {
    id: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084",
    full_name: "Taylor Reed",
    company_name: "Acme Systems",
    email: "taylor@example.test",
    phone: "+1 555 0100",
    job_title: "Operations Director",
    source_id: "5c144f7b-80bd-48f0-8f4c-75a1859176e6",
    status: "qualified",
    owner_id: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2",
    estimated_value: 1250,
    currency: "USD",
    notes_summary: "Looking for a multi-year service agreement.",
    created_at: "2026-04-01T12:00:00Z",
    updated_at: "2026-04-02T12:00:00Z",
  },
  source: "Website",
  ownerLabel: "Workspace member · 6d648c",
};

describe("LeadDetailWorkspace", () => {
  it("renders persisted lead fields and links back to Leads", () => {
    render(<LeadDetailWorkspace detail={detail} />);

    expect(screen.getByRole("heading", { name: "Taylor Reed" })).toBeInTheDocument();
    expect(screen.getByText("Acme Systems")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Workspace member · 6d648c")).toBeInTheDocument();
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "taylor@example.test" })).toHaveAttribute("href", "mailto:taylor@example.test");
    expect(screen.getByRole("link", { name: "+1 555 0100" })).toHaveAttribute("href", "tel:+1 555 0100");
    expect(screen.getByText("Operations Director")).toBeInTheDocument();
    expect(screen.getByText("Looking for a multi-year service agreement.")).toBeInTheDocument();
    expect(screen.getByText("Apr 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Apr 2, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to Leads" })).toHaveAttribute("href", "/app/leads");
  });

  it("omits unavailable optional facts instead of inventing values", () => {
    const missing = {
      ...detail,
      lead: { ...detail.lead, company_name: null, email: null, phone: null, job_title: null, source_id: null, notes_summary: null },
      source: null,
      ownerLabel: null,
    } satisfies LeadDetail;
    render(<LeadDetailWorkspace detail={missing} />);

    for (const label of ["Company", "Job title", "Email", "Phone", "Notes summary", "Owner", "Source"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByText("No additional information is recorded for this lead.")).toBeInTheDocument();
    expect(screen.queryByText(/activity|task|timeline/i)).not.toBeInTheDocument();
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
  });
});
