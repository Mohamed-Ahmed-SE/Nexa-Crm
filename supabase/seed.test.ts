import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { taskTypes } from "../lib/tasks/schema";

const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");
const insertValues = (table: string) =>
  seedSql.match(
    new RegExp(`insert into public\\.${table}\\s*\\([\\s\\S]*?\\)\\s*values([\\s\\S]*?)\\s*on conflict`, "i"),
  )?.[1] ?? "";
const cteValues = (name: string) =>
  seedSql.match(new RegExp(`with ${name}\\s*\\([\\s\\S]*?\\)\\s*as\\s*\\(\\s*values([\\s\\S]*?)\\n\\)`, "i"))?.[1] ?? "";
const seedRowCount = (values: string) => [...values.matchAll(/^\s*\('[0-9a-f-]+'/gm)].length;

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

  it("seeds the documented company and contact counts", () => {
    const companyCount = seedRowCount(insertValues("companies"));
    const contactCount = seedRowCount(insertValues("contacts"));

    expect(companyCount).toBeGreaterThanOrEqual(12);
    expect(companyCount).toBeLessThanOrEqual(18);
    expect(contactCount).toBeGreaterThanOrEqual(25);
  });

  it("seeds the documented lead status distribution", () => {
    const leadValues = cteValues("seed_leads");
    const statuses = [...leadValues.matchAll(/^\s*\('[^']+'(?:::\w+)?(?:,\s*'[^']*'){5},\s*'([^']+)'/gm)].map(([, status]) => status);

    const statusCounts = statuses.reduce<Record<string, number>>((counts, status) => {
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});

    expect(statuses).toHaveLength(20);
    expect(statusCounts).toEqual({ new: 7, contacted: 5, qualified: 5, unqualified: 3 });
  });

  it("seeds enough deals, every open stage, and the required outcomes", () => {
    const dealValues = cteValues("seed_deals");

    expect(seedRowCount(dealValues)).toBeGreaterThanOrEqual(20);
    expect(dealValues.match(/, 'won',/g)).toHaveLength(4);
    expect(dealValues.match(/, 'lost',/g)).toHaveLength(3);
    for (const stage of ["Discovery", "Qualified", "Proposal", "Negotiation"]) {
      expect(dealValues).toContain(`, '${stage}',`);
    }
  });

  it("seeds enough tasks across the documented due-date buckets", () => {
    const taskValues = cteValues("seed_tasks");
    const taskRows = taskValues.split("\n");

    expect(seedRowCount(taskValues)).toBeGreaterThanOrEqual(25);
    expect(taskRows.some((row) => /, 'open',[^\n]*now\(\) - interval/.test(row))).toBe(true);
    expect(taskRows.some((row) => /, 'open',[^\n]*date_trunc\('day', now\(\)\) \+ interval/.test(row))).toBe(true);
    expect(taskRows.some((row) => /, 'open',[^\n]*interval '1 day/.test(row))).toBe(true);
    expect(taskRows.some((row) => /, 'open',[^\n]*interval '(?:7|8|9) days/.test(row))).toBe(true);
    expect(taskRows.some((row) => /, 'completed',/.test(row))).toBe(true);
  });

  it("generates all four activity types for each featured deal", () => {
    const featuredDeals = cteValues("featured_deals");
    expect(seedRowCount(featuredDeals)).toBeGreaterThan(0);
    expect(seedSql).toContain("cross join (values ('meeting'), ('note'), ('stage'), ('task'))");
    expect(seedSql).toContain("else 'task_completed' end");
  });
});
