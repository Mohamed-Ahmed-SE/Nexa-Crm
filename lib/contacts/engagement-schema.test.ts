import { describe, expect, it } from "vitest";
import { contactActivityInputSchema, contactNoteInputSchema, contactTaskInputSchema } from "@/lib/contacts/engagement-schema";

const validDate = "2026-04-03T12:30:00.000Z";

describe("contact engagement input", () => {
  it("accepts supported activity types and requires a subject", () => {
    expect(contactActivityInputSchema.safeParse({ type: "call", subject: "Follow-up", occurredAt: validDate }).success).toBe(true);
    expect(contactActivityInputSchema.safeParse({ type: "other", subject: "Update", occurredAt: validDate }).success).toBe(false);
    expect(contactActivityInputSchema.safeParse({ type: "call", subject: " ", occurredAt: validDate }).success).toBe(false);
  });

  it("rejects blank notes and normalizes surrounding whitespace", () => {
    expect(contactNoteInputSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(contactNoteInputSchema.parse({ body: "  Spoke about renewal.  " })).toEqual({ body: "Spoke about renewal." });
  });

  it("constrains task enums, required due time, and optional assignee", () => {
    const task = { title: "Send proposal", type: "follow_up", priority: "high", dueAt: validDate };
    expect(contactTaskInputSchema.parse(task)).toMatchObject({ title: "Send proposal", assignedTo: null });
    expect(contactTaskInputSchema.safeParse({ ...task, priority: "urgent" }).success).toBe(false);
    expect(contactTaskInputSchema.safeParse({ ...task, dueAt: "tomorrow" }).success).toBe(false);
  });
});
