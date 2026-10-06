import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { markDealWonAction, reopenDealAction } from "../actions";
import type { DealDetail } from "@/lib/deals/repository";
import { DealDetailWorkspace } from "./deal-detail-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ markDealLostAction: vi.fn(), markDealWonAction: vi.fn(), reopenDealAction: vi.fn() }));

const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});
beforeEach(() => vi.clearAllMocks());

const dealDetail: DealDetail = {
  deal: {
    id: "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79",
    pipeline_id: "d47140c3-6c0f-4277-ae4e-7b2c29aef382",
    stage_id: "8dc80d75-85b6-4c7e-a30f-210250b8384c",
    title: "Platform rollout",
    company_id: "012be84b-6794-4e6a-a149-8d92c0a4d110",
    primary_contact_id: "7f55aecc-8873-47ab-bcdd-d921fe5e6edc",
    amount: 125000,
    currency: "USD",
    probability: 75,
    expected_close_date: "2027-01-15",
    owner_id: "c2155412-d8a0-4792-b2bc-f6064b2798f4",
    source_id: null,
    priority: "high",
    description: "Roll out the platform across regional teams.",
    status: "open",
    created_at: "2026-04-01T10:30:00.000Z",
    updated_at: "2026-04-03T15:45:00.000Z",
  },
  company: { id: "012be84b-6794-4e6a-a149-8d92c0a4d110", name: "Northstar Labs" },
  contact: { id: "7f55aecc-8873-47ab-bcdd-d921fe5e6edc", full_name: "Sam Rivera" },
  stage: { id: "8dc80d75-85b6-4c7e-a30f-210250b8384c", name: "Negotiation", stage_type: "open" },
  pipeline: { id: "d47140c3-6c0f-4277-ae4e-7b2c29aef382", name: "New Business" },
  ownerLabel: "Jordan Lee",
  source: null,
  lostReasons: [{ id: "d4d9669e-df9f-4f7d-a392-cb187ffb8d13", name: "Budget" }],
  openStages: [{ id: "8dc80d75-85b6-4c7e-a30f-210250b8384c", name: "Negotiation", position: 4 }],
  activities: [{ id: "7f0197d1-c623-4602-b6db-a36e9ddad8b8", activity_type: "deal_lost", subject: "Deal marked lost", body: "Lost reason: Budget", occurred_at: "2026-04-03T15:45:00.000Z" }],
};

describe("DealDetailWorkspace", () => {
  it("shows persisted deal overview fields and linked company and contact", () => {
    const { container } = render(<DealDetailWorkspace canEdit detail={dealDetail} />);

    expect(screen.getByRole("heading", { level: 1, name: "Platform rollout" })).toBeInTheDocument();
    expect(screen.getByText("Roll out the platform across regional teams.")).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "Deal overview" });
    expect(overview).toHaveTextContent("125,000");
    expect(overview).toHaveTextContent("75%");
    expect(overview).toHaveTextContent("Negotiation");
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("group", { name: "Deal outcome actions" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Activity" })).toHaveTextContent("Lost reason: Budget");

    const relationships = screen.getByRole("region", { name: "Overview" });
    expect(within(relationships).getByRole("link", { name: "Northstar Labs" })).toHaveAttribute("href", "/app/companies/012be84b-6794-4e6a-a149-8d92c0a4d110");
    expect(within(relationships).getByRole("link", { name: "Sam Rivera" })).toHaveAttribute("href", "/app/contacts/7f55aecc-8873-47ab-bcdd-d921fe5e6edc");
  });

  it("shows explicit fallbacks when no company or primary contact is linked", () => {
    render(<DealDetailWorkspace canEdit detail={{ ...dealDetail, company: null, contact: null }} />);

    const overview = screen.getByRole("region", { name: "Overview" });
    expect(within(overview).getByText("No company linked")).toBeInTheDocument();
    expect(within(overview).getByText("No primary contact")).toBeInTheDocument();
    expect(within(overview).queryByRole("link", { name: "Northstar Labs" })).not.toBeInTheDocument();
    expect(within(overview).queryByRole("link", { name: "Sam Rivera" })).not.toBeInTheDocument();
  });

  it("requires a lost reason and explicit handling for open tasks", async () => {
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Lost" }));

    const dialog = await screen.findByRole("dialog", { name: "Mark deal lost" });
    expect(within(dialog).getByRole("combobox", { name: "Lost reason" })).toBeRequired();
    expect(within(dialog).getByRole("combobox", { name: "Related open tasks" })).toBeRequired();
    expect(within(dialog).getByRole("option", { name: "Keep open" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Mark complete" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers the final value and won date before closing an open deal", async () => {
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));

    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    expect(within(dialog).getByRole("spinbutton", { name: "Final amount" })).toHaveValue(125000);
    expect(within(dialog).getByLabelText("Won date")).toHaveValue("2027-01-15");
  });

  it("shows server validation failures without closing the outcome dialog", async () => {
    vi.mocked(markDealWonAction).mockResolvedValue({ ok: false, message: "The deal could not be marked won." });
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The deal could not be marked won.");
  });

  it("shows a recoverable message when the server action request rejects", async () => {
    vi.mocked(markDealWonAction).mockRejectedValue(new Error("network unavailable"));
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The request could not be completed. Check your connection and try again.");
  });

  it("closes the dialog and shows success feedback after an outcome completes", async () => {
    vi.mocked(markDealWonAction).mockResolvedValue({ ok: true, message: "Deal marked won." });
    render(<DealDetailWorkspace canEdit detail={dealDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Won" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark deal won" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark Won" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Deal marked won.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets a closed deal reopen into an active open stage", async () => {
    vi.mocked(reopenDealAction).mockResolvedValue({ ok: true, message: "Deal reopened." });
    const closedDetail = { ...dealDetail, deal: { ...dealDetail.deal, status: "lost" as const }, stage: { ...dealDetail.stage!, stage_type: "lost" as const } };
    render(<DealDetailWorkspace canEdit detail={closedDetail} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen deal" }));

    const dialog = await screen.findByRole("dialog", { name: "Reopen deal" });
    expect(within(dialog).getByRole("combobox", { name: "Reopen in stage" })).toHaveValue("8dc80d75-85b6-4c7e-a30f-210250b8384c");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen deal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deal reopened.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables outcome changes for users who cannot edit this deal", () => {
    render(<DealDetailWorkspace canEdit={false} detail={dealDetail} />);

    expect(screen.getByRole("button", { name: "Mark Won" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Lost" })).toBeDisabled();
    expect(screen.getByText("Outcome changes are unavailable because you cannot edit this deal.")).toBeInTheDocument();
  });
});
