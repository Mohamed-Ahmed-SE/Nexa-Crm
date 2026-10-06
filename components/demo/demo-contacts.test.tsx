import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoContactDetail, DemoContactsDirectory } from "@/components/demo/demo-contacts";
import { createDemoRecords } from "@/lib/dashboard-data";

const records = createDemoRecords(new Date("2025-04-15T12:00:00.000Z"));

describe("fictional demo contacts", () => {
  it("renders every supplied contact as a link in a semantic table", () => {
    render(<DemoContactsDirectory contacts={records.contacts} />);

    const table = screen.getByRole("table", { name: "Fictional demo contacts" });
    expect(within(table).getAllByRole("row")).toHaveLength(records.contacts.length + 1);
    expect(within(table).getByRole("link", { name: "Sarah Chen" })).toHaveAttribute("href", "/demo/contacts/c1");
    expect(within(table).getByRole("columnheader", { name: "Phone" })).toBeInTheDocument();
    expect(within(table).getByText("+1-202-555-0101")).toBeInTheDocument();
    expect(screen.getByText("27 contacts")).toBeInTheDocument();
  });

  it.each([
    ["Sarah Chen", 1],
    ["Luna Commerce", 3],
    ["VP of Product", 1],
    ["sarah.chen@lunacommerce.example.com", 1],
  ])("searches contact name, company, job title, and email with query %s", (query, expectedCount) => {
    render(<DemoContactsDirectory contacts={records.contacts} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), { target: { value: query } });

    expect(screen.getByText(`${expectedCount} ${expectedCount === 1 ? "contact" : "contacts"}`)).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Fictional demo contacts" })).getAllByRole("row")).toHaveLength(expectedCount + 1);
  });

  it("explains when search has no fictional contact matches", () => {
    render(<DemoContactsDirectory contacts={records.contacts} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), { target: { value: "not a real contact" } });

    expect(screen.getByText("0 contacts")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No fictional contacts match");
    expect(screen.queryByRole("table", { name: "Fictional demo contacts" })).not.toBeInTheDocument();
  });

  it("shows fixture-backed contact, company, exact-name deal, and company-task facts read-only", () => {
    const contact = records.contacts[0];
    const company = records.companies.find((record) => record.name === contact.company);
    const deals = records.deals.filter((record) => record.contact === contact.name);
    const companyTasks = records.tasks.filter((record) => record.relatedTo === contact.company);
    render(<DemoContactDetail company={company} companyTasks={companyTasks} contact={contact} deals={deals} />);

    expect(screen.getByRole("heading", { name: "Sarah Chen" })).toBeInTheDocument();
    expect(screen.getByText("Fictional · read-only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to contacts" })).toHaveAttribute("href", "/demo/contacts");
    expect(screen.getByText("sarah.chen@lunacommerce.example.com")).toBeInTheDocument();
    expect(screen.getByText("Ecommerce")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deals matching this contact" }).closest("section")).toHaveTextContent("Platform redesign");
    expect(screen.queryByText("Fleet visibility rollout")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Company-related tasks" }).closest("section")).toHaveTextContent("These tasks are related to the company, not assigned to this contact.");
    expect(screen.getByText("Send revised scope")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
