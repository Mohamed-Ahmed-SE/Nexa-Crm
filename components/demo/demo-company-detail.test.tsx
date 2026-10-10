import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoCompanyDetail } from "@/components/demo/demo-company-detail";
import { createDemoRecords, formatCurrency } from "@/lib/dashboard-data";

const now = new Date("2025-04-15T12:00:00.000Z");
const records = createDemoRecords(now);

function renderCompany(id: string) {
  const company = records.companies.find((record) => record.id === id);
  if (!company) throw new Error(`Missing sample company ${id}`);
  render(<DemoCompanyDetail company={company} now={now} records={records} />);
  return {
    company,
    contacts: records.contacts.filter((contact) => contact.company === company.name),
    deals: records.deals.filter((deal) => deal.company === company.name),
    activities: records.activities.filter((activity) => activity.detail.includes(company.name)),
    tasks: records.tasks.filter((task) => task.relatedTo === company.name),
  };
}

describe("fictional demo company detail", () => {
  it("derives company metrics and links exact-name contacts and deals", () => {
    const { company, contacts, deals } = renderCompany(records.companies[0].id);
    const openDeals = deals.filter((deal) => deal.status === "open");
    const openDealValue = openDeals.reduce((total, deal) => total + deal.amount, 0);

    expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument();
    expect(screen.getByText("Fictional · read-only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to companies" })).toHaveAttribute("href", "/demo/companies");

    const metrics = screen.getByRole("region", { name: "Company summary metrics" });
    expect(metrics).toHaveTextContent(formatCurrency(openDealValue));
    expect(metrics).toHaveTextContent(String(contacts.length));
    expect(metrics).toHaveTextContent(String(openDeals.length));

    const contactsSection = screen.getByRole("region", { name: "Contacts" });
    for (const contact of contacts) {
      expect(within(contactsSection).getByRole("link", { name: contact.name })).toHaveAttribute("href", `/demo/contacts/${contact.id}`);
    }

    const dealsSection = screen.getByRole("region", { name: "Deals" });
    for (const deal of deals) {
      expect(within(dealsSection).getByRole("link", { name: deal.title })).toHaveAttribute("href", `/demo/deals/${deal.id}`);
    }

    const properties = screen.getByRole("region", { name: "Company properties" });
    expect(properties).toHaveTextContent("Domain");
    expect(properties).toHaveTextContent("Employee band");
    expect(properties).toHaveTextContent("Not included in sample data");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows matching company activity and tasks, with the earliest open task", () => {
    const { company, activities, tasks } = renderCompany(records.companies[0].id);
    const matchedActivities = activities.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const orderedTasks = tasks.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    const expectedNextTask = orderedTasks.find((task) => task.status === "open");

    const activitySection = screen.getByRole("region", { name: "Activity" });
    expect(activitySection).toHaveTextContent(`Sample activities whose detail mentions ${company.name}`);
    for (const activity of matchedActivities) {
      expect(within(activitySection).getByText(activity.title)).toBeInTheDocument();
    }

    const taskSection = screen.getByRole("region", { name: "Tasks" });
    expect(taskSection).toHaveTextContent(`exact related-to match for ${company.name}`);
    if (expectedNextTask) {
      const nextTaskSection = screen.getByRole("region", { name: "Next open task" });
      expect(nextTaskSection).toHaveTextContent(expectedNextTask.title);
      expect(within(taskSection).getByText(expectedNextTask.title)).toBeInTheDocument();
      if (new Date(expectedNextTask.dueAt) < now) {
        expect(nextTaskSection).toHaveTextContent("Overdue");
      }
    } else {
      expect(screen.getByRole("status", { name: /No open company-related task/ })).toBeInTheDocument();
    }
  });

  it("states when company notes and files are absent from the sample", () => {
    renderCompany(records.companies[0].id);

    expect(screen.getByRole("region", { name: "Notes" })).toHaveTextContent("No dedicated company notes are included in this sample data.");
    expect(screen.getByRole("region", { name: "Files" })).toHaveTextContent("No company files are included in this sample data.");
  });
});
