import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: { refresh: vi.fn() },
  updateProfileAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("./actions", () => ({ updateProfileAction: mocks.updateProfileAction }));

import { ProfileForm } from "./profile-form";

const profile = {
  fullName: "Alex Chen",
  avatarUrl: null,
  phone: null,
  jobTitle: null,
  timezone: "America/New_York",
};

describe("ProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let saveNumber = 0;
    mocks.updateProfileAction.mockImplementation(async () => ({
      ok: true,
      message: `Profile saved ${++saveNumber}.`,
    }));
  });

  it("regression: refreshes the shell for each successful save", async () => {
    render(<ProfileForm profile={profile} />);
    const saveButton = screen.getByRole("button", { name: "Save profile" });

    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved 1.");

    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved 2.");
  });
});
