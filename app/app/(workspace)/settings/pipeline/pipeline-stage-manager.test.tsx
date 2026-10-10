import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { deactivatePipelineStageAction, reorderPipelineStagesAction } from "./actions";
import { PipelineStageManager } from "./pipeline-stage-manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  createPipelineStageAction: vi.fn(),
  deactivatePipelineStageAction: vi.fn(),
  renamePipelineStageAction: vi.fn(),
  reorderPipelineStagesAction: vi.fn(),
  updatePipelineStageProbabilityAction: vi.fn(),
}));

const pipeline = { id: "pipeline-1", name: "Sales" };
const activeStage = {
  id: "stage-open",
  pipeline_id: pipeline.id,
  name: "Qualified",
  position: 1,
  probability: 35,
  stage_type: "open",
  is_active: true,
};

describe("PipelineStageManager", () => {
  it("offers an accessible add-stage form when the pipeline has no stages", () => {
    render(<PipelineStageManager pipelines={[pipeline]} stages={[]} />);

    const name = screen.getByRole("textbox", { name: "New stage name for Sales" });
    const probability = screen.getByRole("spinbutton", { name: "Default probability for new stage in Sales" });
    expect(name).toBeRequired();
    expect(name).toHaveAttribute("maxLength", "100");
    expect(probability).toBeRequired();
    expect(probability).toHaveAttribute("min", "0");
    expect(probability).toHaveAttribute("max", "100");
    expect(probability).toHaveAttribute("step", "1");
    expect(screen.getByRole("button", { name: "Add stage" })).toBeEnabled();
  });

  it("offers disabling only for active open stages", () => {
    const inactiveStage = { ...activeStage, id: "stage-inactive", name: "Parked", is_active: false };
    const wonStage = { ...activeStage, id: "stage-won", name: "Won", stage_type: "won" };
    render(<PipelineStageManager pipelines={[pipeline]} stages={[activeStage, inactiveStage, wonStage]} />);

    expect(screen.getAllByRole("button", { name: "Disable stage" })).toHaveLength(1);
    expect(screen.getByText("Inactive stage")).toBeInTheDocument();
    expect(screen.getByText("Terminal · Won")).toBeInTheDocument();
  });

  it("shows pending and actionable refusal feedback while disabling a stage", async () => {
    const user = userEvent.setup();
    let finishAction!: (state: Awaited<ReturnType<typeof deactivatePipelineStageAction>>) => void;
    vi.mocked(deactivatePipelineStageAction).mockImplementation(() => new Promise((resolve) => {
      finishAction = resolve;
    }));
    render(<PipelineStageManager pipelines={[pipeline]} stages={[activeStage]} />);

    const disableButton = screen.getByRole("button", { name: "Disable stage" });
    await user.click(disableButton);
    expect(screen.getByRole("button", { name: "Disabling…" })).toBeDisabled();
    finishAction({ message: "This stage still has open deals. Move or close them before disabling it." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Move or close them before disabling it.");
  });

  it("submits only refreshed active stage IDs after disabling a stage", async () => {
    const user = userEvent.setup();
    const secondStage = { ...activeStage, id: "stage-second", name: "Discovery", position: 2 };
    const thirdStage = { ...activeStage, id: "stage-third", name: "Review", position: 3 };
    const newlyActiveStage = { ...activeStage, id: "stage-new", name: "Nurture", position: 4 };
    vi.mocked(deactivatePipelineStageAction).mockResolvedValue({ ok: true, message: "Stage disabled." });
    let submittedStageIds: FormDataEntryValue | null = null;
    vi.mocked(reorderPipelineStagesAction).mockImplementation(async (_previous, form) => {
      submittedStageIds = form.get("stageIds");
      return { message: "Reorder submitted." };
    });
    const { rerender } = render(<PipelineStageManager pipelines={[pipeline]} stages={[activeStage, secondStage, thirdStage]} />);

    await user.click(screen.getByRole("button", { name: "Move Review up" }));
    await user.click(within(screen.getByRole("group", { name: "Actions for Qualified" })).getByRole("button", { name: "Disable stage" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Stage disabled.");

    rerender(<PipelineStageManager pipelines={[pipeline]} stages={[secondStage, thirdStage, newlyActiveStage]} />);
    await user.click(screen.getByRole("button", { name: "Save stage order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reorder submitted.");
    expect(submittedStageIds).toBe(JSON.stringify(["stage-third", "stage-second", "stage-new"]));
  });

  it("shows the current probability in an accessible editable control for an active open stage", () => {
    render(<PipelineStageManager pipelines={[pipeline]} stages={[activeStage]} />);

    const probability = screen.getByRole("spinbutton", { name: "Default probability for Qualified" });
    expect(probability).toHaveValue(35);
    expect(probability).toHaveAttribute("min", "0");
    expect(probability).toHaveAttribute("max", "100");
    expect(probability).toHaveAttribute("step", "1");
  });
});
