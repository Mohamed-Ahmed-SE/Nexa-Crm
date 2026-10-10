import { z } from "zod";

export const pipelineStageIdSchema = z.string().uuid("Choose a valid pipeline stage.");
export const pipelineIdSchema = z.string().uuid("Choose a valid pipeline.");
export const pipelineStageNameSchema = z.string().trim().min(1, "Enter a stage name.").max(100, "Stage names must be 100 characters or fewer.");
export const pipelineStageProbabilitySchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? Number.NaN : value,
  z.coerce.number().int("Probability must be a whole number.").min(0, "Probability must be at least 0.").max(100, "Probability must be at most 100."),
);

export const updatePipelineStageProbabilitySchema = z.object({
  stageId: pipelineStageIdSchema,
  probability: pipelineStageProbabilitySchema,
});

export const renamePipelineStageSchema = z.object({
  stageId: pipelineStageIdSchema,
  name: pipelineStageNameSchema,
});

export const createPipelineStageSchema = z.object({
  pipelineId: pipelineIdSchema,
  name: pipelineStageNameSchema,
  probability: pipelineStageProbabilitySchema,
});

export const reorderPipelineStagesSchema = z.object({
  pipelineId: pipelineIdSchema,
  stageIds: z.array(pipelineStageIdSchema).min(1, "This pipeline has no reorderable stages."),
}).superRefine(({ stageIds }, context) => {
  if (new Set(stageIds).size !== stageIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["stageIds"], message: "Each stage must appear once." });
  }
});
