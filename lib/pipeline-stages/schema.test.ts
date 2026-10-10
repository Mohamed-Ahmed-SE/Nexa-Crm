import { describe, expect, it } from "vitest";
import { createPipelineStageSchema, pipelineStageNameSchema, renamePipelineStageSchema, reorderPipelineStagesSchema, updatePipelineStageProbabilitySchema } from "./schema";

const pipelineId = "5d8d7e69-565c-4f99-8599-2f6df86c1025";
const stageOne = "b7d84fee-ea44-4578-948a-3bc3da2d69c3";
const stageTwo = "e5acdd22-512e-49ef-8d9d-0ed6cb5dc144";

describe("pipeline stage validation", () => {
  it("trims valid names and rejects empty or oversized names", () => {
    expect(pipelineStageNameSchema.parse("  Prospecting  ")).toBe("Prospecting");
    expect(pipelineStageNameSchema.safeParse(" ").success).toBe(false);
    expect(pipelineStageNameSchema.safeParse("x".repeat(101)).success).toBe(false);
  });

  it("validates stage identities before a rename", () => {
    expect(renamePipelineStageSchema.safeParse({ stageId: stageOne, name: "Prospecting" }).success).toBe(true);
    expect(renamePipelineStageSchema.safeParse({ stageId: "not-a-uuid", name: "Prospecting" }).success).toBe(false);
  });

  it("trims names and validates pipeline identity when creating a stage", () => {
    const parsed = createPipelineStageSchema.safeParse({ pipelineId, name: "  Prospecting  ", probability: "50" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Prospecting");
    expect(createPipelineStageSchema.safeParse({ pipelineId: "not-a-uuid", name: "Prospecting", probability: "50" }).success).toBe(false);
    expect(createPipelineStageSchema.safeParse({ pipelineId, name: " ", probability: "50" }).success).toBe(false);
    expect(createPipelineStageSchema.safeParse({ pipelineId, name: "x".repeat(100), probability: "50" }).success).toBe(true);
    expect(createPipelineStageSchema.safeParse({ pipelineId, name: "x".repeat(101), probability: "50" }).success).toBe(false);
  });

  it.each([
    ["0", 0, true],
    ["100", 100, true],
    ["51", 51, true],
    ["-1", undefined, false],
    ["101", undefined, false],
    ["2.5", undefined, false],
    ["", undefined, false],
    ["invalid", undefined, false],
    [undefined, undefined, false],
  ])("validates creation probability %j", (probability, expected, valid) => {
    const parsed = createPipelineStageSchema.safeParse({ pipelineId, name: "Prospecting", probability });
    expect(parsed.success).toBe(valid);
    if (valid && parsed.success) expect(parsed.data.probability).toBe(expected);
  });

  it.each([
    [stageOne, "0", 0, true],
    [stageOne, "100", 100, true],
    [stageOne, "51", 51, true],
    [stageOne, "-1", undefined, false],
    [stageOne, "101", undefined, false],
    [stageOne, "2.5", undefined, false],
    [stageOne, "", undefined, false],
    [stageOne, "invalid", undefined, false],
    ["not-a-uuid", "50", undefined, false],
  ])("validates default probability %j %j", (stageId, probability, expected, valid) => {
    const result = updatePipelineStageProbabilitySchema.safeParse({ stageId, probability });
    expect(result.success).toBe(valid);
    if (valid && result.success) expect(result.data.probability).toBe(expected);
  });

  it.each([
    [[stageOne, stageTwo], true],
    [[stageOne, stageOne], false],
    [[stageOne, "not-a-uuid"], false],
    [[], false],
  ])("validates the proposed stage order %j", (stageIds, valid) => {
    expect(reorderPipelineStagesSchema.safeParse({ pipelineId, stageIds }).success).toBe(valid);
  });
});
