import { describe, expect, it } from "vitest";
import { formatNextTask, selectNextTasksByDeal } from "./next-tasks";

describe("deal next-task presentation", () => {
  it("selects the earliest due open task for each related deal", () => {
    const nextTasks = selectNextTasksByDeal([
      { title: "Later call", due_at: "2026-04-08T12:00:00.000Z", related_entity_id: "deal-1", status: "open" },
      { title: "Earlier email", due_at: "2026-04-05T12:00:00.000Z", related_entity_id: "deal-1", status: "open" },
      { title: "Completed task", due_at: "2026-04-01T12:00:00.000Z", related_entity_id: "deal-1", status: "completed" },
      { title: "Undated task", due_at: null, related_entity_id: "deal-2", status: "open" },
      { title: "Unrelated task", due_at: "2026-04-01T12:00:00.000Z", related_entity_id: null, status: "open" },
    ]);

    expect(nextTasks).toEqual({
      "deal-1": { title: "Earlier email", due_at: "2026-04-05T12:00:00.000Z" },
      "deal-2": { title: "Undated task", due_at: null },
    });
  });

  it.each([
    [{ title: "Send proposal", due_at: "2026-04-05" }, "Send proposal · 04/05/2026"],
    [{ title: "Prepare agenda", due_at: null }, "Prepare agenda"],
  ])("formats a task with an optional due date", (task, expected) => {
    expect(formatNextTask(task, "MM/DD/YYYY")).toBe(expected);
  });
});
