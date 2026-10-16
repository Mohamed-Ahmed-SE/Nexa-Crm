import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileDeleteControl } from "./file-actions";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const file = { id: "file-1", filename: "proposal.pdf" };
const deleteAction = vi.fn();
type Result = { ok: boolean; message: string };

function renderControl(overrides: Partial<typeof file> = {}) {
  return render(<FileDeleteControl deleteAction={deleteAction} entityId="entity-1" entityIdName="contactId" file={{ ...file, ...overrides }} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteAction.mockReset();
});

describe("FileDeleteControl", () => {
  it("requires confirmation before deleting, then shows success and refreshes", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: Result) => void;
    deleteAction.mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    renderControl();

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    expect(screen.getByText("Delete proposal.pdf? This cannot be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep file" }));
    expect(deleteAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "File deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("File deleted.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = deleteAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("contactId")).toBe("entity-1");
    expect(submitted.get("fileId")).toBe("file-1");
  });

  it("announces a delete failure while keeping the confirmation open and without refreshing", async () => {
    const user = userEvent.setup();
    deleteAction.mockResolvedValueOnce({ message: "File not found. Refresh and try again." });
    renderControl();

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("File not found. Refresh and try again.");
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it("cancels back to the delete button without calling the action", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("button", { name: "Delete proposal.pdf" }));
    await user.click(screen.getByRole("button", { name: "Keep file" }));

    expect(screen.getByRole("button", { name: "Delete proposal.pdf" })).toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();
  });
});
