import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { waitForResponse, withNextServer } from "./next-server.mjs";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const manager = { id: "00000000-0000-4000-8000-000000000102", email: "maya.hassan@northstar-demo.example" };
const workspaceId = "00000000-0000-4000-8000-000000000001";
const tableNames = ["leads", "contacts", "companies", "deals"];

function statusValue(output, name) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  const value = line.slice(name.length + 1).trim();
  return value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
}

function localSupabaseConfig() {
  let output;
  try {
    output = execFileSync("npx", ["--yes", "supabase", "status", "-o", "env"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000,
    });
  } catch {
    throw new Error("Could not read local Supabase CLI status; start the disposable local Supabase stack first.");
  }

  let api;
  try { api = new URL(statusValue(output, "API_URL")); }
  catch { throw new Error("Local Supabase CLI status did not provide a valid API_URL."); }
  if (api.protocol !== "http:" || api.username || api.password || !loopbackHosts.has(api.hostname)) {
    throw new Error("Authenticated E2E requires a loopback HTTP Supabase API_URL.");
  }

  const anonKey = statusValue(output, "ANON_KEY");
  const serviceRoleKey = statusValue(output, "SERVICE_ROLE_KEY");
  if (!anonKey || !serviceRoleKey) throw new Error("Local Supabase CLI status did not provide local Auth configuration.");
  return { apiUrl: api.origin, anonKey, serviceRoleKey };
}

function makeSearchRows(runId, createdBy) {
  const marker = `sort-${runId}`;
  const tieTime = "2025-04-01T00:00:00.000Z";
  const newestTime = "2025-04-02T00:00:00.000Z";
  const entries = Array.from({ length: 6 }, (_, index) => {
    const tieOrder = index === 0 ? 6 : index;
    const suffix = String(tieOrder).padStart(4, "0");
    const id = `10000000-0000-4000-8000-${runId}${suffix}`;
    return { index, id, created_at: index === 0 ? newestTime : tieTime };
  });
  const byInsertionOrder = [...entries].reverse();
  const makeEntity = (table) => byInsertionOrder.map(({ index, id, created_at }) => {
    const label = `${marker} ${table} ${index + 1}`;
    const base = { id, workspace_id: workspaceId, created_by: createdBy, created_at };
    if (table === "leads") return { ...base, full_name: label, currency: "USD" };
    if (table === "contacts") return { ...base, first_name: marker, last_name: `${table} ${index + 1}` };
    if (table === "companies") return { ...base, name: label };
    return { ...base, title: label, currency: "USD" };
  });
  return { marker, entries, rows: Object.fromEntries(tableNames.map((table) => [table, makeEntity(table)])) };
}

async function removeTestRows(admin, idsByTable) {
  for (const table of ["deals", "contacts", "leads", "companies"]) {
    const { error } = await admin.from(table).delete().eq("workspace_id", workspaceId).in("id", idsByTable[table]);
    if (error) throw new Error(`Could not clean up the authenticated search ${table} rows.`);
  }
}

test("authenticated workspace search shows the newest five records with id-ordered ties", { timeout: 180_000 }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = localSupabaseConfig();
  const password = randomBytes(32).toString("base64url");
  const runId = randomBytes(4).toString("hex");
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { marker, entries, rows } = makeSearchRows(runId, manager.id);
  const idsByTable = Object.fromEntries(tableNames.map((table) => [table, entries.map(({ id }) => id)]));
  let browser;
  let failure;

  try {
    const { error: provisionError } = await admin.auth.admin.updateUserById(manager.id, { password, email_confirm: true });
    if (provisionError) throw new Error("Could not provision the seeded manager through the local Auth admin API.");

    const { data: stage, error: stageError } = await admin.from("pipeline_stages").select("pipeline_id,id")
      .eq("workspace_id", workspaceId).eq("stage_type", "open").eq("is_active", true).limit(1).single();
    if (stageError || !stage) throw new Error("Could not find an active open stage in the seeded local workspace.");
    rows.deals = rows.deals.map((row) => ({ ...row, pipeline_id: stage.pipeline_id, stage_id: stage.id }));

    for (const table of tableNames) {
      const { error } = await admin.from(table).insert(rows[table]);
      if (error) throw new Error(`Could not create disposable authenticated search ${table} rows.`);
    }

    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`${origin}/auth/sign-in`);
      await page.getByRole("textbox", { name: "Email" }).fill(manager.email);
      await page.getByRole("textbox", { name: "Password" }).fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => url.pathname.startsWith("/app/"), { timeout: 30_000 });
      await page.getByRole("button", { name: "Search CRM" }).click();
      await page.getByRole("searchbox", { name: "Search this workspace" }).fill(marker);

      for (const [table, group] of [["leads", "Leads"], ["contacts", "Contacts"], ["companies", "Companies"], ["deals", "Deals"]]) {
        const recordNames = page.getByRole("region", { name: group }).locator("strong");
        await recordNames.first().waitFor({ state: "visible" });
        const visibleNames = await recordNames.allTextContents();
        const expectedNames = entries.slice(0, 5).map(({ index }) => `${marker} ${table} ${index + 1}`);
        assert.deepEqual(visibleNames, expectedNames, `${group} should be newest-first, tie-broken by id, and limited to five`);
      }
      await browser.close();
      browser = undefined;
    }, [anonKey, serviceRoleKey, password]);
  } catch (error) {
    failure = error;
  } finally {
    if (browser) {
      try { await browser.close(); }
      catch (closeError) { if (!failure) failure = closeError; }
    }
    try { await removeTestRows(admin, idsByTable); }
    catch (cleanupError) { if (!failure) failure = cleanupError; }
  }

  if (failure) throw failure;
});
