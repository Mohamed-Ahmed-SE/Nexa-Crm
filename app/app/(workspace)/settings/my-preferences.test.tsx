import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyPreferences } from "./my-preferences";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./preferences-actions", () => ({ updateDateFormatAction: vi.fn() }));

describe("MyPreferences", () => {
  it("previews supported date orders and shows the persisted selection", () => {
    render(<MyPreferences dateFormat="DD/MM/YYYY" />);

    const selector = screen.getByRole("combobox", { name: "Date format" });
    expect(selector).toHaveValue("DD/MM/YYYY");
    expect(screen.getByText("Example: 05/04/2026")).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: "YYYY-MM-DD" } });
    expect(screen.getByText("Example: 2026-04-05")).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
  });
});
