import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LeadDetailError from "./error";

describe("LeadDetailError", () => {
  it("shows a generic alert without leaking the error message and retries via reset", () => {
    const reset = vi.fn();
    render(<LeadDetailError error={new Error("secret db connection string leaked")} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Lead could not be loaded");
    expect(alert).not.toHaveTextContent("secret db connection string leaked");
    expect(screen.getByRole("link", { name: "Return to Leads" })).toHaveAttribute("href", "/app/leads");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
