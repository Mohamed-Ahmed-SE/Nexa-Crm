import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEditDeleteControls } from "./activity-actions";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const activity: { id: string; activity_type: string; subject: string | null; body: string | null; occurred_at: string } = { id: "activity-1", activity_type: "call", subject: "Discovery call", body: "Discussed timing.", occurred_at: "2026-04-03T12:00:00.000Z" };
const updateAction = vi.fn();
const deleteAction = vi.fn();
type Result = { ok: boolean; message: string };

function renderControls(overrides: Partial<typeof activity> = {}) {
  return render(<ActivityEditDeleteControls activity={{ ...activity, ...overrides }} deleteAction={deleteAction} entityId="entity-1" entityIdName="dealId" updateAction={updateAction} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  updateAction.mockReset();
  deleteAction.mockReset();
});

describe("ActivityEditDeleteControls", () => {
  it("opens an editor prefilled with the activity and submits the changed fields with pending, success and refresh", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: Result) => void;
    updateAction.mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    renderControls();

    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    expect(screen.getByRole("combobox", { name: "Activity type" })).toHaveValue("call");
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue("Discovery call");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Discussed timing.");
    const occurredAt = screen.getByLabelText("Occurred at") as HTMLInputElement;
    expect(new Date(occurredAt.value).toISOString()).toBe("2026-04-03T12:00:00.000Z");

    await user.selectOptions(screen.getByRole("combobox", { name: "Activity type" }), "meeting");
    await user.clear(screen.getByRole("textbox", { name: "Subject" }));
    await user.type(screen.getByRole("textbox", { name: "Subject" }), "Renewal meeting");
    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    fireEvent.change(occurredAt, { target: { value: "2026-05-01T09:30" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishAction({ ok: true, message: "Activity updated." });
    expect(await screen.findByRole("status")).toHaveTextContent("Activity updated.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = updateAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("dealId")).toBe("entity-1");
    expect(submitted.get("activityId")).toBe("activity-1");
    expect(submitted.get("type")).toBe("meeting");
    expect(submitted.get("subject")).toBe("Renewal meeting");
    expect(submitted.get("body")).toBe("");
    expect(submitted.get("occurredAt")).toBe("2026-05-01T09:30");
    expect(submitted.get("timezoneOffset")).toBe(String(new Date("2026-05-01T09:30").getTimezoneOffset()));
    expect(screen.queryByRole("textbox", { name: "Subject" })).not.toBeInTheDocument();
  });

  it("offers only the manual activity types", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    const options = Array.from((screen.getByRole("combobox", { name: "Activity type" }) as HTMLSelectElement).options).map((option) => option.value);
    expect(options).toEqual(["call", "email", "meeting", "note"]);
  });

  it("tolerates an activity without subject or body", async () => {
    const user = userEvent.setup();
    renderControls({ subject: null, body: null });
    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("");
  });

  it("keeps the editor open with an alert when saving fails and closes it on cancel without refreshing", async () => {
    const user = userEvent.setup();
    updateAction.mockResolvedValueOnce({ message: "You can update only activities you created." });
    renderControls();

    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can update only activities you created.");
    expect(screen.getByRole("textbox", { name: "Subject" })).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Subject" })).not.toBeInTheDocument();
    expect(updateAction).toHaveBeenCalledTimes(1);
  });

  it("shows field validation feedback from the server", async () => {
    const user = userEvent.setup();
    updateAction.mockResolvedValueOnce({ message: "Check the activity details.", fieldErrors: { subject: ["Enter an activity subject."] } });
    renderControls();
    await user.click(screen.getByRole("button", { name: "Edit activity" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent)).toEqual(expect.arrayContaining(["Enter an activity subject.", "Check the activity details."]));
  });

  it("requires confirmation before deleting, then shows success and refreshes", async () => {
    const user = userEvent.setup();
    let finishAction!: (response: Result) => void;
    deleteAction.mockReturnValueOnce(new Promise((resolve) => { finishAction = resolve; }));
    renderControls();

    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    expect(screen.getByText("Delete this activity? This cannot be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep activity" }));
    expect(deleteAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finishAction({ ok: true, message: "Activity deleted." });
    expect(await screen.findByRole("status")).toHaveTextContent("Activity deleted.");
    await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledTimes(1));
    const submitted = deleteAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("dealId")).toBe("entity-1");
    expect(submitted.get("activityId")).toBe("activity-1");
  });

  it("announces a delete failure while keeping the confirmation open", async () => {
    const user = userEvent.setup();
    deleteAction.mockResolvedValueOnce({ message: "Activity could not be deleted. Refresh the deal and try again." });
    renderControls();
    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Activity could not be deleted. Refresh the deal and try again.");
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});
