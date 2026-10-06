import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { taskTypes } from "../lib/tasks/schema";

const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");

describe("demo task seed data", () => {
  it("uses a supported task type", () => {
    const assignedTaskType = seedSql.match(
      /insert into public\.tasks\s*\([\s\S]*?\)\s*select[\s\S]*?\n\s*'([^']+)',\s*t\.status,/,
    )?.[1];

    expect(assignedTaskType).toBeDefined();
    expect(taskTypes).toContain(assignedTaskType);
  });
});
