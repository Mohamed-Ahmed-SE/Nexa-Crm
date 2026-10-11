import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { createWorkspaceAction } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/validation";

vi.mock("@/lib/auth/actions", () => ({
  createWorkspaceAction: vi.fn(async (...args: [FormState, FormData]) => ({ message: args[0].message })),
}));

describe("OnboardingForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves details through the three steps and submits the selected pipeline only at the end", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.type(screen.getByLabelText(/workspace name/i), "Nexa Sales");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Your role").closest("li")).toHaveAttribute("aria-current", "step");

    await user.type(screen.getByLabelText(/your role or job title/i), "Sales lead");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("radio", { name: /Standard Sales/ })).toBeChecked();
    expect(createWorkspaceAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/your role or job title/i)).toHaveValue("Sales lead");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/workspace name/i)).toHaveValue("Nexa Sales");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("radio", { name: /Simple Sales/ }));
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() => expect(createWorkspaceAction).toHaveBeenCalledOnce());

    const submittedFields = vi.mocked(createWorkspaceAction).mock.calls[0]?.[1];
    expect(submittedFields.get("workspaceName")).toBe("Nexa Sales");
    expect(submittedFields.get("jobTitle")).toBe("Sales lead");
    expect(submittedFields.get("pipelineTemplate")).toBe("simple_sales");
  });

  it("lets users skip template selection with the Standard Sales default", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.type(screen.getByLabelText(/workspace name/i), "Nexa Sales");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(createWorkspaceAction).toHaveBeenCalledOnce());
    const submittedFields = vi.mocked(createWorkspaceAction).mock.calls[0]?.[1];
    expect(submittedFields.get("pipelineTemplate")).toBe("standard_sales");
  });
});
