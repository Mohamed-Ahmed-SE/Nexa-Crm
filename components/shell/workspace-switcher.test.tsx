import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import type { WorkspaceContext } from "@/lib/auth/context";
import { switchWorkspaceAction } from "@/lib/auth/workspace-actions";

vi.mock("@/lib/auth/workspace-actions", () => ({ switchWorkspaceAction: vi.fn() }));

const context: WorkspaceContext = {
  userId: "user-1",
  email: "alex@example.com",
  fullName: "Alex Chen",
  workspaceId: "workspace-1",
  workspaceName: "Acme",
  role: "admin",
  dateFormat: "MM/DD/YYYY",
  avatarUrl: null,
  workspaces: [
    { id: "workspace-1", name: "Acme" },
    { id: "workspace-2", name: "Northwind" },
  ],
};

describe("WorkspaceSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the active workspace and submits a keyboard-selectable alternative", async () => {
    vi.mocked(switchWorkspaceAction).mockResolvedValue({
      error: "Workspace switch failed. Your current workspace is unchanged. Refresh and try again.",
    });
    const user = userEvent.setup();
    render(<WorkspaceSwitcher context={context} />);
    const selector = screen.getByRole("combobox", { name: "Switch workspace" });

    expect(selector).toHaveValue("workspace-1");
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    await user.selectOptions(selector, "workspace-2");
    await user.click(screen.getByRole("button", { name: "Switch" }));

    const submittedForm = vi.mocked(switchWorkspaceAction).mock.calls[0]?.[1];
    expect(submittedForm).toBeInstanceOf(FormData);
    expect(submittedForm?.get("workspaceId")).toBe("workspace-2");
    expect(await screen.findByRole("alert")).toHaveTextContent(/current workspace is unchanged/);
    expect(selector).toHaveValue(context.workspaceId);
  });
});
