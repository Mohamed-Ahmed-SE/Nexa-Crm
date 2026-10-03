import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarNavigation } from "@/components/shell/sidebar-navigation";

const workspaceRoutes = [
  ["Dashboard", "/app/dashboard"],
  ["Leads", "/app/leads"],
  ["Contacts", "/app/contacts"],
  ["Companies", "/app/companies"],
  ["Deals", "/app/deals"],
  ["Tasks", "/app/tasks"],
  ["Reports", "/app/reports"],
  ["Notifications", "/app/notifications"],
  ["Settings", "/app/settings"],
];

describe("SidebarNavigation", () => {
  it("exposes working links to each workspace route", () => {
    render(<SidebarNavigation activePath="/app/dashboard" />);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });

    for (const [label, href] of workspaceRoutes) {
      expect(within(navigation).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("marks only the current page as current", () => {
    render(<SidebarNavigation activePath="/app/deals" />);

    expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leads" })).not.toHaveAttribute("aria-current");
  });
});
