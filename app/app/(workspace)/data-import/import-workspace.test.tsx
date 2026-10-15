import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportWorkspace } from "./import-workspace";

const { importCsvAction } = vi.hoisted(() => ({ importCsvAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ importCsvAction }));

const emptyHistory = { initialEntity: "leads" as const, historyJobs: [], historyError: false };

function csvFile(contents: string, name = "leads.csv") {
  const file = new File([contents], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => contents });
  return file;
}

async function selectCsv(contents: string) {
  fireEvent.change(screen.getByLabelText("CSV file (up to 5 MB)"), {
    target: { files: [csvFile(contents)] },
  });
  await screen.findByRole("heading", { name: "Map columns" });
}

describe("ImportWorkspace CSV choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importCsvAction.mockResolvedValue({
      ok: true,
      message: "Import finished: 1 imported, 1 need attention.",
      imported: 1,
      rejected: 1,
      errors: [{ row: 3, errors: ["fullName: Enter a lead name."] }],
    });
  });

  it("imports valid rows, skips invalid rows, and reveals their errors in the summary", async () => {
    render(<ImportWorkspace {...emptyHistory} />);
    await selectCsv("Name,Email\nJordan Lee,jordan@example.com\n,missing@example.com");
    expect(screen.getByRole("navigation", { name: "CSV import progress" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Preview and validation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review preview" }));

    expect(screen.getByText("2 rows detected · 1 valid · 1 invalid · create-only import")).toBeInTheDocument();
    expect(screen.getByText("1 valid row passes preview validation and will be submitted; 1 invalid preview row will be skipped. Additional import failures will be shown in the summary.")).toBeInTheDocument();
    expect(screen.getByText("Row 3: Enter a lead name.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to confirmation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to confirmation" }));
    expect(screen.getByRole("heading", { name: "Confirm import" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm and import 1 valid row · Skip 1 invalid" })).toBeInTheDocument();
    expect(importCsvAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and import 1 valid row · Skip 1 invalid" }));

    await waitFor(() => expect(importCsvAction).toHaveBeenCalledOnce());
    const submittedRows = JSON.parse(importCsvAction.mock.calls[0][0].get("rows") as string);
    expect(submittedRows).toHaveLength(2);
    expect(submittedRows.map((row: { fullName: string }) => row.fullName)).toEqual(["Jordan Lee", ""]);
    expect(await screen.findByRole("heading", { name: "Import summary" })).toBeInTheDocument();
    expect(screen.getByText("Row 3: fullName: Enter a lead name.")).toBeInTheDocument();
  });

  it("keeps the user on column mapping when a required field is unmapped", async () => {
    render(<ImportWorkspace {...emptyHistory} />);
    await selectCsv("Email\njordan@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Review preview" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Map each required field before reviewing the preview.");
    expect(screen.queryByRole("heading", { name: "Preview and validation" })).not.toBeInTheDocument();
    expect(importCsvAction).not.toHaveBeenCalled();
  });

  it("cancels and clears the preview so a corrected CSV can be selected", async () => {
    render(<ImportWorkspace {...emptyHistory} />);
    await selectCsv("Name,Email\n,missing@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Review preview" }));
    expect(screen.getByText("Row 2: Enter a lead name.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel and fix file" }));

    expect(screen.queryByRole("heading", { name: "Preview and validation" })).not.toBeInTheDocument();
    expect(screen.queryByText("Row 2: Enter a lead name.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("CSV file (up to 5 MB)")).toHaveValue("");
    expect(importCsvAction).not.toHaveBeenCalled();

    await selectCsv("Name,Email\nJordan Lee,jordan@example.com");
    expect(screen.queryByRole("heading", { name: "Preview and validation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review preview" }));
    expect(screen.getByText("1 row detected · 1 valid · 0 invalid · create-only import")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to confirmation" })).toBeInTheDocument();
  });
});
