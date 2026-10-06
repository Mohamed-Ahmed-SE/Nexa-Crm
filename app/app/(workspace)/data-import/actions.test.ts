import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  persistedRows: [] as Array<{ table: string; values: Record<string, unknown> }>,
  defaultCurrency: "EUR",
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { importCsvAction } from "./actions";

const workspaceId = "5a4302eb-742b-49cb-9f0d-bfc96e9474c3";
const userId = "6d648c6b-8d8f-4a16-90c4-72f3c31c61a2";

function importForm(entity: string, rows: string) {
  const form = new FormData();
  form.set("entity", entity);
  form.set("rows", rows);
  return form;
}

function supabaseBoundary() {
  return {
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { default_currency: mocks.defaultCurrency }, error: null }),
        insert: async (values: Record<string, unknown>) => {
          mocks.persistedRows.push({ table, values });
          return { error: null };
        },
      };
      return query;
    },
  };
}

describe("CSV import action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistedRows.length = 0;
    mocks.defaultCurrency = "EUR";
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "manager" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabaseBoundary());
  });

  it("blocks a role without CRM create access before persisting anything", async () => {
    mocks.requirePermission.mockResolvedValue({ workspaceId, userId, role: "viewer" });

    await expect(importCsvAction(importForm("leads", JSON.stringify([{ fullName: "Jordan Lee" }]))))
      .rejects.toThrow("Import permission requires CRM create access.");

    expect(mocks.persistedRows).toEqual([]);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects malformed untrusted JSON before persistence", async () => {
    const result = await importCsvAction(importForm("leads", "{not-json"));

    expect(result).toEqual({
      ok: false,
      message: "The mapped CSV could not be read. Review the file and try again.",
      imported: 0,
      rejected: 0,
      errors: [],
    });
    expect(mocks.persistedRows).toEqual([]);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("persists scoped mapped rows and history matching the mixed-row result", async () => {
    const result = await importCsvAction(importForm("leads", JSON.stringify([
      { fullName: "  Jordan Lee  ", email: "jordan@example.com", estimatedValue: "1250.50", status: "qualified" },
      { fullName: "", estimatedValue: "0" },
    ])));

    expect(result).toEqual({
      ok: true,
      message: "Import finished: 1 imported, 1 need attention.",
      imported: 1,
      rejected: 1,
      errors: [{ row: 3, errors: ["fullName: Enter a lead name."] }],
    });
    expect(mocks.persistedRows).toEqual([
      {
        table: "leads",
        values: {
          workspace_id: workspaceId,
          created_by: userId,
          owner_id: userId,
          full_name: "Jordan Lee",
          company_name: null,
          email: "jordan@example.com",
          phone: null,
          job_title: null,
          status: "qualified",
          estimated_value: 1250.5,
          notes_summary: null,
          source_id: null,
          currency: "EUR",
        },
      },
      {
        table: "crm_import_jobs",
        values: {
          workspace_id: workspaceId,
          created_by: userId,
          entity: "leads",
          status: "completed_with_errors",
          total_rows: 2,
          imported_rows: 1,
          rejected_rows: 1,
          row_errors: [{ row: 3, errors: ["fullName: Enter a lead name."] }],
        },
      },
    ]);
  });
});
