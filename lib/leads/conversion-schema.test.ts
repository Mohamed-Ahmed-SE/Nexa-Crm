import { describe, expect, it } from "vitest";
import { leadConversionSchema } from "@/lib/leads/conversion-schema";

const conversion = {
  createContact: true, createCompany: false, createDeal: true,
  contactFirstName: "Taylor", contactLastName: "Reed", companyName: "",
  dealTitle: "Acme Renewal", pipelineId: "5c144f7b-80bd-48f0-8f4c-75a1859176e6",
  stageId: "9d26f4d8-85c7-47f0-a3fd-f2be2c7ff084", dealOwnerId: "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2", dealValue: "1250", closeDate: "2026-12-31",
};

describe("lead conversion input", () => {
  it("normalizes validated options for selected targets", () => {
    expect(leadConversionSchema.parse(conversion)).toMatchObject({ dealValue: 1250, closeDate: "2026-12-31", createContact: true });
  });

  it("rejects no targets and missing details only for selected targets", () => {
    expect(leadConversionSchema.safeParse({ ...conversion, createContact: false, createDeal: false }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, contactLastName: "" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, createContact: false, dealTitle: "", stageId: "" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, dealOwnerId: "" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, createContact: false, createDeal: false, createCompany: true, companyName: "Acme" }).success).toBe(true);
  });

  it("allows omitted deal inputs when conversion creates only a contact or company", () => {
    const parsed = leadConversionSchema.safeParse({
      ...conversion, createDeal: false, dealTitle: "", pipelineId: "", stageId: "", dealOwnerId: "", dealValue: "", closeDate: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ dealValue: null, pipelineId: null, stageId: null, dealOwnerId: null, closeDate: null });
  });

  it("rejects negative values and malformed relation/date inputs", () => {
    expect(leadConversionSchema.safeParse({ ...conversion, dealValue: "-1" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, stageId: "foreign" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, dealValue: "" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, closeDate: "12/31/2026" }).success).toBe(false);
    expect(leadConversionSchema.safeParse({ ...conversion, closeDate: "2026-02-31" }).success).toBe(false);
  });
});
