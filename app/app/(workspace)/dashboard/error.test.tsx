import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardError from "./error";

describe("DashboardError", () => {
  it("shows a generic alert without leaking the error message and retries via reset", () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("secret db connection string leaked")} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Dashboard could not be loaded");
    expect(alert).not.toHaveTextContent("secret db connection string leaked");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
