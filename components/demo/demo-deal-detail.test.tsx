import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoDealDetail } from "@/components/demo/demo-deal-detail";
import { createDemoRecords, formatCurrency } from "@/lib/dashboard-data";

const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));

function renderDeal(id: string) {
  const deal = records.deals.find((record) => record.id === id);
  if (!deal) throw new Error(`Missing sample deal ${id}`);
  const contact = records.contacts.find((record) => record.name === deal.contact);
  const dealReference = `${deal.title} · ${deal.company}`;
  const activities = records.activities.filter((activity) => activity.detail.includes(dealReference));
  const companyTasks = records.tasks.filter((task) => task.relatedTo === deal.company);
  render(<DemoDealDetail activities={activities} companyTasks={companyTasks} contact={contact} deal={deal} />);
  return { deal, activities, companyTasks };
}

describe("fictional demo deal detail", () => {
  it("shows supplied deal facts, stage-default probability, and its linked primary contact", () => {
    const { deal } = renderDeal("d1");

    expect(screen.getByRole("heading", { name: deal.title })).toBeInTheDocument();
    expect(screen.getByText("Fictional · read-only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/demo/deals");
    const properties = screen.getByRole("region", { name: "Deal properties" });
    expect(properties).toHaveTextContent(deal.company);
    expect(properties).toHaveTextContent(deal.stage);
    expect(properties).toHaveTextContent(deal.status);
    expect(properties).toHaveTextContent(formatCurrency(deal.amount));
    expect(properties).toHaveTextContent(deal.owner);
    expect(properties).toHaveTextContent(deal.source);
    expect(properties).toHaveTextContent("60%");
    expect(screen.getByText(/fictional sample’s stage default/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: deal.contact })).toHaveAttribute("href", "/demo/contacts/c1");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("includes only activity referencing this deal and labels company tasks clearly", () => {
    const { deal, activities, companyTasks } = renderDeal("d1");
    const activitySection = screen.getByRole("region", { name: "Activity timeline" });
    const taskSection = screen.getByRole("region", { name: "Company-related tasks" });

    expect(activities.length).toBeGreaterThan(0);
    expect(within(activitySection).getByText(activities[0].title)).toBeInTheDocument();
    expect(within(activitySection).queryByText("Scope review scheduled")).not.toBeInTheDocument();
    expect(taskSection).toHaveTextContent(`Tasks related to ${deal.company}`);
    expect(taskSection).toHaveTextContent("they are not assigned to this deal");
    expect(companyTasks.length).toBeGreaterThan(0);
    expect(within(taskSection).getByText(companyTasks[0].title)).toBeInTheDocument();

    const dueTime = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
    }).format(new Date(companyTasks[0].dueAt));
    expect(within(taskSection).getByText(dueTime)).toBeInTheDocument();
    expect(dueTime).not.toMatch(/12\s?PM/i);
  });

  it("shows accessible empty states for absent activity and company tasks", () => {
    const deal = records.deals.find((record) => record.id === "d24");
    if (!deal) throw new Error("Missing sample deal d24");
    render(<DemoDealDetail activities={[]} companyTasks={[]} contact={undefined} deal={deal} />);

    const emptyStates = screen.getAllByRole("status");
    expect(emptyStates).toHaveLength(3);
    expect(emptyStates[0]).toHaveTextContent("No matching contact is present in the sample records.");
    expect(emptyStates[1]).toHaveTextContent("No sample activity references this deal.");
    expect(emptyStates[2]).toHaveTextContent("No sample tasks are related to this company.");
  });
});
