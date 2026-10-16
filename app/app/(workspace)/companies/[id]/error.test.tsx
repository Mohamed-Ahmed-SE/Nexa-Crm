import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompanyDetailError from "./error";

describe("CompanyDetailError", () => {
  it("shows a generic alert without leaking the error message and retries via reset", () => {
    const reset = vi.fn();
    render(<CompanyDetailError error={new Error("secret db connection string leaked")} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Company could not be loaded");
    expect(alert).not.toHaveTextContent("secret db connection string leaked");
    expect(screen.getByRole("link", { name: "Companies" })).toHaveAttribute("href", "/app/companies");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
