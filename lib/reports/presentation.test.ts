import { describe, expect, it } from "vitest";
import { buildReportCsv, calculateWinRate } from "@/lib/reports/presentation";

describe("report presentation", () => {
  it("calculates win rate from closed outcomes only and leaves an empty denominator undefined", () => {
    expect(calculateWinRate(2, 1)).toBe("67%");
    expect(calculateWinRate(0, 0)).toBe("—");
  });

  it("escapes CSV cells and prevents formula execution in exported values", () => {
    expect(buildReportCsv([["Deal", "Owner"], ["A, B \"Group\"", " =1+1"]])).toBe('"Deal","Owner"\r\n"A, B ""Group""","\' =1+1"');
  });
});
