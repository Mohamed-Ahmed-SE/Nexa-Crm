import { describe, expect, it } from "vitest";
import { isStaleLead } from "./attention";

const now = new Date("2026-04-15T12:00:00.000Z");
const lead = {
  id: "lead-1",
  fullName: "Taylor Reed",
  status: "new" as const,
  createdAt: "2026-04-01T12:00:00.000Z",
};

function stale(options: { status?: typeof lead.status | "contacted" | "qualified" | "unqualified" | "converted"; createdAt?: string; latestActivityAt?: string | null } = {}) {
  return isStaleLead({
    lead: { ...lead, ...options },
    latestActivityAt: options.latestActivityAt ?? null,
    now,
  });
}

describe("lead stale attention rule", () => {
  it.each([
    ["new", true],
    ["contacted", true],
    ["qualified", true],
    ["unqualified", false],
    ["converted", false],
  ] as const)("applies only to eligible %s leads", (status, expected) => {
    expect(stale({ status })).toBe(expected);
  });

  it("uses creation time when there is no activity and includes the 14-day boundary", () => {
    expect(stale({ createdAt: "2026-04-01T12:00:00.000Z" })).toBe(true);
    expect(stale({ createdAt: "2026-04-01T12:00:00.001Z" })).toBe(false);
    expect(stale({ createdAt: "2026-04-02T12:00:00.000Z" })).toBe(false);
  });

  it("uses recent activity instead of creation time", () => {
    expect(stale({ latestActivityAt: "2026-04-15T11:59:59.999Z" })).toBe(false);
    expect(stale({ latestActivityAt: "2026-04-01T12:00:00.000Z" })).toBe(true);
  });
});
