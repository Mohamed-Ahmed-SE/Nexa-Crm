import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "@/components/shell/global-search";
import type { GlobalSearchResults } from "@/lib/search/global-search";

const { globalSearchAction } = vi.hoisted(() => ({ globalSearchAction: vi.fn() }));
vi.mock("@/lib/search/actions", () => ({ globalSearchAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const populatedResults: GlobalSearchResults = {
  lead: [{ id: "l1", name: "Ada Lovelace", type: "lead", context: "Founder · Analytical Engines", href: "/app/leads?q=Ada" }],
  contact: [{ id: "c1", name: "Ada Lovelace", type: "contact", context: "Founder · Analytical Engines", href: "/app/contacts/c1" }],
  company: [{ id: "co1", name: "Analytical Engines", type: "company", context: "Software", href: "/app/companies/co1" }],
  deal: [{ id: "d1", name: "Engine contract", type: "deal", context: "Analytical Engines · Ada Lovelace · open", href: "/app/deals/d1" }],
};

beforeEach(() => {
  globalSearchAction.mockReset();
  globalSearchAction.mockResolvedValue({ ok: true, results: populatedResults });
});

describe("GlobalSearch", () => {
  it("opens from Cmd/Ctrl+K, groups results, and closes with focus restored", async () => {
    render(<GlobalSearch canCreate={true} />);
    const trigger = screen.getByRole("button", { name: /Search CRM/ });
    trigger.focus();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    expect(input).toHaveFocus();

    await userEvent.type(input, "Ada");
    const dialog = screen.getByRole("dialog");
    const matchingResults = await within(dialog).findAllByRole("link", { name: /Ada Lovelace.*Founder/ });
    expect(matchingResults[0]).toHaveAttribute("href", "/app/leads?q=Ada");
    expect(within(dialog).getByRole("region", { name: "Leads" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Contacts" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Companies" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Deals" })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps a newer query when an older server response arrives late", async () => {
    let resolveOlder: ((response: { ok: true; results: GlobalSearchResults }) => void) | undefined;
    globalSearchAction.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }));
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    fireEvent.change(input, { target: { value: "old" } });
    await waitFor(() => expect(globalSearchAction).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "new" } });
    expect((await screen.findAllByRole("link", { name: /Ada Lovelace.*Founder/ })).length).toBeGreaterThan(0);
    await act(async () => {
      resolveOlder?.({ ok: true, results: { ...populatedResults, lead: [{ id: "stale", name: "Outdated record", type: "lead", context: "Old result", href: "/app/leads?q=old" }] } });
    });
    expect(screen.getAllByRole("link", { name: /Ada Lovelace.*Founder/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Outdated record/ })).not.toBeInTheDocument();
  });

  it("shows empty and error states and suppresses create actions without permission", async () => {
    globalSearchAction.mockResolvedValueOnce({ ok: true, results: { lead: [], contact: [], company: [], deal: [] } });
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search this workspace" }), "nobody");
    expect(await screen.findByText("No matching records found.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Quick create" })).not.toBeInTheDocument();

    globalSearchAction.mockResolvedValueOnce({ ok: false, message: "Search could not be completed. Please try again." });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search this workspace" }), { target: { value: "error" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Search could not be completed");
  });

  it("offers only the existing create routes to users with create permission", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={true} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const actions = screen.getByRole("navigation", { name: "Quick create" });
    expect(within(actions).getByRole("link", { name: "Add Lead" })).toHaveAttribute("href", "/app/leads?create=1");
    expect(within(actions).getByRole("link", { name: "Add Contact" })).toHaveAttribute("href", "/app/contacts?create=1");
    expect(within(actions).getByRole("link", { name: "Add Deal" })).toHaveAttribute("href", "/app/deals?create=1");
  });

  it("does not invoke the shortcut while focus is in an editable control", () => {
    render(<><input aria-label="Other form field" /><GlobalSearch canCreate={false} /></>);
    const field = screen.getByRole("textbox", { name: "Other form field" });
    field.focus();
    fireEvent.keyDown(field, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
