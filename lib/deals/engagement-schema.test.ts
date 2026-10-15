import { describe, expect, it } from "vitest";
import { dealActivityInputSchema, dealNoteInputSchema, dealTaskInputSchema } from "./engagement-schema";

describe("deal engagement schemas", () => {
  it("trims activity text, normalizes an empty body, and rejects unsupported types", () => {
    expect(dealActivityInputSchema.parse({
      type: "call", subject: "  Discovery  ", body: "  ", occurredAt: "2026-04-03T12:00:00.000Z",
    })).toMatchObject({ subject: "Discovery", body: null });
    expect(dealActivityInputSchema.safeParse({ type: "system", subject: "x", occurredAt: "invalid" }).success).toBe(false);
  });

  it("requires a non-empty note within the length limit", () => {
    expect(dealNoteInputSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(dealNoteInputSchema.safeParse({ body: "  Negotiation notes  " })).toMatchObject({ success: true, data: { body: "Negotiation notes" } });
  });

  it("validates task title, type, priority, due time, and optional assignee", () => {
    expect(dealTaskInputSchema.safeParse({
      title: "  Send quote  ", description: "  ", type: "follow_up", priority: "high",
      dueAt: "2026-04-04T12:00:00.000Z", assignedTo: "",
    })).toMatchObject({ success: true, data: { title: "Send quote", description: null, assignedTo: null } });
    expect(dealTaskInputSchema.safeParse({ title: "Task", type: "invalid", priority: "high", dueAt: "not-a-date" }).success).toBe(false);
  });
});
