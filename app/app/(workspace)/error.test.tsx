import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceError from "./error";

describe("WorkspaceError", () => {
  it("shows a generic alert without leaking the error message and retries via reset", () => {
    const reset = vi.fn();
    render(<WorkspaceError error={new Error("secret db connection string leaked")} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).not.toHaveTextContent("secret db connection string leaked");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
