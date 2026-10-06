import { describe, expect, it } from "vitest";
import { lostDealOutcomeSchema } from "@/lib/deals/schema";

describe("lost deal action input", () => {
  it("requires a workspace lost reason and explicit handling for related tasks", () => {
    const parseResult = lostDealOutcomeSchema.safeParse({
      id: "b5bb4ec1-f535-4f61-a8cc-c4c98fac9b79",
      lostReasonId: "",
      competitor: "",
      note: "",
      taskChoice: "",
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.flatten().fieldErrors).toHaveProperty("lostReasonId");
      expect(parseResult.error.flatten().fieldErrors).toHaveProperty("taskChoice");
    }
  });
});
