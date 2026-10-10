import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoLeadDetail } from "@/components/demo/demo-lead-detail";
import { createDemoRecords, formatCurrency } from "@/lib/dashboard-data";

const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));
const lead = records.leads.find((record) => record.id === "l1");
if (!lead) throw new Error("Missing sample lead l1");

describe("fictional demo lead detail", () => {
  it("shows fixture-backed lead and exact-name company facts without inferring contact or activity relationships", () => {
    const company = records.companies.find((record) => record.name === lead.company);
    const companyTasks = records.tasks.filter((task) => task.relatedTo === lead.company);
    render(<DemoLeadDetail company={company} companyTasks={companyTasks} lead={lead} />);

    expect(screen.getByRole("heading", { name: lead.name })).toBeInTheDocument();
    expect(screen.getByText("Fictional · read-only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to leads" })).toHaveAttribute("href", "/demo/leads");
    expect(screen.getByRole("navigation", { name: "Lead detail sections" })).toHaveTextContent("OverviewActivityTasksNotesFiles");

    const overview = screen.getByRole("region", { name: "Overview" });
    expect(overview).toHaveTextContent(lead.company);
    expect(overview).toHaveTextContent(lead.status);
    expect(overview).toHaveTextContent(formatCurrency(lead.estimatedValue));

    const properties = screen.getByRole("region", { name: "Lead properties" });
    expect(properties).toHaveTextContent(lead.source);
    expect(properties).toHaveTextContent(lead.owner);
    expect(properties).toHaveTextContent(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(lead.createdAt)));
    expect(properties).toHaveTextContent("TagsNot included in sample data");
    expect(properties).toHaveTextContent("Contact fieldsNot included in sample data");

    const companySummary = screen.getByRole("region", { name: "Company summary · exact name match" });
    expect(companySummary).toHaveTextContent(company?.industry ?? "");
    expect(companySummary).toHaveTextContent(company?.owner ?? "");

    const activity = screen.getByRole("region", { name: "Activity" });
    expect(activity).toHaveTextContent("No lead-specific activity, or last/next activity, is available");
    expect(within(activity).queryByText("Proposal shared")).not.toBeInTheDocument();

    const tasks = screen.getByRole("region", { name: "Company-related tasks" });
    expect(tasks).toHaveTextContent(`related to ${lead.company}, not to this lead`);
    expect(tasks).toHaveTextContent("not assigned to the lead");
    expect(companyTasks.length).toBeGreaterThan(0);
    const firstTask = within(tasks).getByText(companyTasks[0].title).closest("li");
    expect(firstTask).not.toBeNull();
    expect(within(firstTask as HTMLElement).getByText(new RegExp(`Owner: ${companyTasks[0].owner}`))).toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Notes" })).toHaveTextContent("No lead-specific notes");
    expect(screen.getByRole("region", { name: "Files" })).toHaveTextContent("No lead-specific files");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /convert|log activity|add task/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Sarah Chen")).not.toBeInTheDocument();
  });

  it("keeps unavailable company and task data explicit", () => {
    render(<DemoLeadDetail company={undefined} companyTasks={[]} lead={lead} />);

    expect(screen.getByRole("region", { name: "Company summary · exact name match" })).toHaveTextContent(`No company record with the exact name “${lead.company}”`);
    expect(screen.getByRole("region", { name: "Company-related tasks" })).toHaveTextContent("No sample tasks are related to this company.");
    expect(screen.getByRole("region", { name: "Last / next activity" })).toHaveTextContent("Not available for this lead in the sample data.");
  });
});
