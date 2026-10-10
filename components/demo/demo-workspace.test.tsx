import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoShell } from "@/components/demo/demo-shell";
import { DemoWorkspaceSection } from "@/components/demo/demo-workspace";
import { createDemoRecords, formatCurrency, selectDemoReports } from "@/lib/dashboard-data";

vi.mock("next/navigation", () => ({ usePathname: () => "/demo/leads" }));

describe("read-only demo workspace", () => {
  it("makes every demo section discoverable and marks the current section", () => {
    render(<DemoShell><p>Demo content</p></DemoShell>);

    const navigation = screen.getByRole("navigation", { name: "Demo workspace" });
    expect(within(navigation).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/demo", "/demo/leads", "/demo/contacts", "/demo/companies", "/demo/deals", "/demo/tasks", "/demo/reports",
    ]);
    expect(within(navigation).getByRole("link", { name: "Leads" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/demo/contacts");
    expect(screen.getByText("All records are fictional. Changes are not saved.")).toBeInTheDocument();
  });

  it("links each company title to its sample company detail page", () => {
    const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
    render(<DemoWorkspaceSection section="companies" />);

    const table = screen.getByRole("table", { name: "Fictional demo companies" });
    expect(within(table).getAllByRole("row")).toHaveLength(records.companies.length + 1);
    for (const company of records.companies) {
      expect(within(table).getByRole("link", { name: company.name })).toHaveAttribute("href", `/demo/companies/${company.id}`);
    }
  });

  it("links each deal title to its sample deal detail page", () => {
    const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
    render(<DemoWorkspaceSection section="deals" />);

    const table = screen.getByRole("table", { name: "Fictional demo deals" });
    expect(within(table).getAllByRole("row")).toHaveLength(records.deals.length + 1);
    for (const deal of records.deals) {
      expect(within(table).getByRole("link", { name: deal.title })).toHaveAttribute("href", `/demo/deals/${deal.id}`);
    }
  });

  it("links each lead title to its sample lead detail page", () => {
    const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
    render(<DemoWorkspaceSection section="leads" />);

    const table = screen.getByRole("table", { name: "Fictional demo leads" });
    expect(within(table).getAllByRole("row")).toHaveLength(records.leads.length + 1);
    for (const lead of records.leads) {
      expect(within(table).getByRole("link", { name: lead.name })).toHaveAttribute("href", `/demo/leads/${lead.id}`);
    }
  });

  it("filters every lead status without exposing record mutation actions", () => {
    const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
    render(<DemoWorkspaceSection section="leads" />);
    const statusFilter = screen.getByRole("combobox", { name: "Filter by status" });
    const table = screen.getByRole("table", { name: "Fictional demo leads" });

    fireEvent.change(statusFilter, { target: { value: "Qualified" } });
    expect(within(table).getAllByRole("row")).toHaveLength(records.leads.filter((lead) => lead.status === "Qualified").length + 1);
    expect(within(table).getByText("Yusuf Hassan")).toBeInTheDocument();
    expect(within(table).queryByText("Aiden Brooks")).not.toBeInTheDocument();

    fireEvent.change(statusFilter, { target: { value: "Unqualified" } });
    expect(within(table).getAllByRole("row")).toHaveLength(records.leads.filter((lead) => lead.status === "Unqualified").length + 1);
    expect(within(table).getByText("Theo Grant")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add|edit|delete|convert|import/i })).not.toBeInTheDocument();
  });

  it("shows fixture-derived report values and filters the top-deal list", () => {
    const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
    const report = selectDemoReports(records);
    render(<DemoWorkspaceSection section="reports" />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Sample sales summary" });
    expect(summary).toHaveTextContent(formatCurrency(report.wonRevenue));
    expect(summary).toHaveTextContent(String(report.totalDeals));
    expect(summary).toHaveTextContent(`${Math.round(report.winRate * 100)}%`);
    expect(summary).toHaveTextContent(formatCurrency(report.averageDealValue));
    expect(screen.getByText(new RegExp(`${report.totalContacts} sample contacts`))).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Highest-value fictional deals" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search top deals" }), { target: { value: report.topDeals[0].title } });
    const table = screen.getByRole("table", { name: "Highest-value fictional deals" });
    expect(within(table).getByText(report.topDeals[0].title)).toBeInTheDocument();
    expect(within(table).queryByText(report.topDeals[1].title)).not.toBeInTheDocument();
  });
});
