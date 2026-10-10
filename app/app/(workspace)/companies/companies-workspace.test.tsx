import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompaniesWorkspace } from "./companies-workspace";

const mocks = vi.hoisted(() => ({ createCompanyAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/auth/date-format-provider", () => ({ useDateFormat: () => "MDY" }));
vi.mock("./actions", () => ({
  addCompanyNoteAction: vi.fn(),
  archiveCompanyAction: vi.fn(),
  completeCompanyTaskAction: vi.fn(),
  createCompanyAction: mocks.createCompanyAction,
  createCompanyTaskAction: vi.fn(),
  logCompanyActivityAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  uploadCompanyFileAction: vi.fn(),
}));

const workspaceProps = {
  companies: [],
  matchedCount: 0,
  totalCount: 0,
  owners: [],
  search: "",
  ownerId: "",
  page: 1,
  canCreate: true,
  canImport: false,
  canExport: false,
  canEditAll: false,
  canEditOwn: false,
  currentUserId: "user-1",
};

describe("CompaniesWorkspace create form", () => {
  it("announces matches and offers an explicit add-anyway action", async () => {
    const user = userEvent.setup();
    mocks.createCompanyAction.mockResolvedValue({
      duplicateMatches: [{ id: "company-1", name: "Acme Group", website: "https://acme.example" }],
    });
    render(<CompaniesWorkspace {...workspaceProps} />);

    await user.click(screen.getAllByRole("button", { name: "Add company" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Add company" });
    await user.type(within(dialog).getByRole("textbox", { name: /Company name/ }), "Acme Group");
    await user.click(within(dialog).getByRole("button", { name: "Add company" }));

    const warning = await within(dialog).findByRole("status");
    expect(warning).toHaveTextContent("Acme Group");
    expect(warning).toHaveTextContent("https://acme.example");
    expect(within(dialog).getByRole("button", { name: "Add company anyway" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
