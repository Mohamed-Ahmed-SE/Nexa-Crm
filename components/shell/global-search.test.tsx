import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "@/components/shell/global-search";
import type { GlobalSearchResults } from "@/lib/search/global-search";

const { globalSearchAction, pathname } = vi.hoisted(() => ({ globalSearchAction: vi.fn(), pathname: { current: "/app/dashboard" } }));
vi.mock("@/lib/search/actions", () => ({ globalSearchAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => pathname.current }));

const populatedResults: GlobalSearchResults = {
  lead: [{ id: "l1", name: "Ada Lovelace", type: "lead", context: "Founder · Analytical Engines", href: "/app/leads/l1" }],
  contact: [{ id: "c1", name: "Ada Lovelace", type: "contact", context: "Founder · Analytical Engines", href: "/app/contacts/c1" }],
  company: [{ id: "co1", name: "Analytical Engines", type: "company", context: "Software", href: "/app/companies/co1" }],
  deal: [{ id: "d1", name: "Engine contract", type: "deal", context: "Analytical Engines · Ada Lovelace · open", href: "/app/deals/d1" }],
};

beforeEach(() => {
  pathname.current = "/app/dashboard";
  globalSearchAction.mockReset();
  globalSearchAction.mockResolvedValue({ ok: true, results: populatedResults });
});

describe("GlobalSearch", () => {
  it("opens from documented shortcuts, groups results, and restores focus after close", async () => {
    render(<GlobalSearch canCreate={true} />);
    const trigger = screen.getByRole("button", { name: /Search CRM/ });
    trigger.focus();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    expect(input).toHaveFocus();

    await userEvent.type(input, "Ada");
    const dialog = screen.getByRole("dialog");
    const matchingResults = await within(dialog).findAllByRole("link", { name: /Ada Lovelace.*Founder/ });
    expect(matchingResults[0]).toHaveAttribute("href", "/app/leads/l1");
    expect(within(dialog).getByRole("region", { name: "Leads" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Contacts" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Companies" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Deals" })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByRole("searchbox", { name: "Search this workspace" })).toHaveFocus();
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
      resolveOlder?.({ ok: true, results: { ...populatedResults, lead: [{ id: "stale", name: "Outdated record", type: "lead", context: "Old result", href: "/app/leads/stale" }] } });
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

  it("offers all create routes only to users with create permission", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={true} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const actions = screen.getByRole("navigation", { name: "Quick create" });
    expect(within(actions).getByRole("link", { name: "Add Lead" })).toHaveAttribute("href", "/app/leads?create=1");
    expect(within(actions).getByRole("link", { name: "Add Contact" })).toHaveAttribute("href", "/app/contacts?create=1");
    expect(within(actions).getByRole("link", { name: "Add Company" })).toHaveAttribute("href", "/app/companies?create=1");
    expect(within(actions).getByRole("link", { name: "Add Deal" })).toHaveAttribute("href", "/app/deals?create=1");
    expect(within(actions).getByRole("link", { name: "Add Task" })).toHaveAttribute("href", "/app/tasks?create=1");
    expect(within(actions).queryByRole("link", { name: "Add Note" })).not.toBeInTheDocument();
  });

  it.each([
    ["leads", "?createTask=1", "?createNote=1"],
    ["contacts", "?view=tasks&createTask=1", "?createNote=1"],
    ["companies", "?section=Tasks&createTask=1", "?section=Notes&createNote=1"],
    ["deals", "?createTask=1", "?createNote=1"],
  ])("associates task and note create routes with a valid %s detail record", async (entity, taskQuery, noteQuery) => {
    const detailPath = `/app/${entity}/83d8aaf1-c78e-41db-ae18-493f44c84b42`;
    pathname.current = detailPath;
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={true} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const actions = screen.getByRole("navigation", { name: "Quick create" });
    expect(within(actions).getByRole("link", { name: "Add Task" })).toHaveAttribute("href", `${detailPath}${taskQuery}`);
    expect(within(actions).getByRole("link", { name: "Add Note" })).toHaveAttribute("href", `${detailPath}${noteQuery}`);
  });

  it("does not offer record-specific note creation for an invalid detail path", async () => {
    pathname.current = "/app/deals/not-a-uuid";
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={true} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const actions = screen.getByRole("navigation", { name: "Quick create" });
    expect(within(actions).queryByRole("link", { name: "Add Note" })).not.toBeInTheDocument();
    expect(within(actions).getByRole("link", { name: "Add Task" })).toHaveAttribute("href", "/app/tasks?create=1");
  });

  it("ignores search shortcuts while focus is in an editable control", () => {
    render(<><input aria-label="Other form field" /><GlobalSearch canCreate={false} /></>);
    const field = screen.getByRole("textbox", { name: "Other form field" });
    field.focus();
    fireEvent.keyDown(field, { key: "k", metaKey: true });
    fireEvent.keyDown(field, { key: "/" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates to the second result with ArrowDown then Enter", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    await user.type(input, "Ada");
    const dialog = screen.getByRole("dialog");
    await within(dialog).findAllByRole("option");

    await user.keyboard("{ArrowDown}");
    const firstOption = within(dialog).getAllByRole("option")[0];
    expect(firstOption).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", firstOption.id);

    await user.keyboard("{ArrowDown}");
    const secondOption = within(dialog).getAllByRole("option")[1];
    expect(secondOption).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("wraps to the last result with ArrowUp from the first result", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    await user.type(input, "Ada");
    const dialog = screen.getByRole("dialog");
    const options = await within(dialog).findAllByRole("option");

    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("does nothing on Enter when there are no results", async () => {
    globalSearchAction.mockResolvedValueOnce({ ok: true, results: { lead: [], contact: [], company: [], deal: [] } });
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    await user.type(input, "nobody");
    await screen.findByText("No matching records found.");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resets the active result after a new query returns different results", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch canCreate={false} />);
    await user.click(screen.getByRole("button", { name: /Search CRM/ }));
    const input = screen.getByRole("searchbox", { name: "Search this workspace" });
    await user.type(input, "Ada");
    const dialog = screen.getByRole("dialog");
    await within(dialog).findAllByRole("option");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(within(dialog).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    globalSearchAction.mockResolvedValueOnce({ ok: true, results: { ...populatedResults, lead: [], contact: [] } });
    await user.clear(input);
    await user.type(input, "new query");
    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2));
    const refreshedOptions = within(dialog).getAllByRole("option");
    expect(refreshedOptions.every((option) => option.getAttribute("aria-selected") === "false")).toBe(true);
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    expect(refreshedOptions[0]).toHaveAttribute("aria-selected", "true");
  });
});
