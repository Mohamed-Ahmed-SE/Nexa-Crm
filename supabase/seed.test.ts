import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { taskTypes } from "../lib/tasks/schema";

const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");

describe("demo seed data", () => {
  it("uses a supported task type", () => {
    const assignedTaskType = seedSql.match(
      /insert into public\.tasks\s*\([\s\S]*?\)\s*select[\s\S]*?\n\s*'([^']+)',\s*t\.status,/,
    )?.[1];

    expect(assignedTaskType).toBeDefined();
    expect(taskTypes).toContain(assignedTaskType);
  });

  it("keeps seeded contacts in their company's workspace", () => {
    const companySeed = seedSql.match(
      /insert into public\.companies\s*\([\s\S]*?\)\s*values([\s\S]*?)\s*on conflict/i,
    )?.[1];
    const contactSeed = seedSql.match(
      /insert into public\.contacts\s*\([\s\S]*?\)\s*values([\s\S]*?)\s*on conflict/i,
    )?.[1];
    expect(companySeed).toBeDefined();
    expect(contactSeed).toBeDefined();

    const companyWorkspaceById = new Map(
      [...companySeed!.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'/g)].map(([, companyId, workspaceId]) => [companyId, workspaceId]),
    );
    const contactRows = [...contactSeed!.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(?:'([^']+)'|null)/gi)];
    const mismatchedContacts = contactRows.filter(([, , workspaceId, companyId]) =>
      companyId !== undefined && companyWorkspaceById.get(companyId) !== workspaceId,
    );

    expect(companyWorkspaceById.size).toBeGreaterThan(0);
    expect(contactRows.length).toBeGreaterThan(0);
    expect(mismatchedContacts).toEqual([]);
  });
});
