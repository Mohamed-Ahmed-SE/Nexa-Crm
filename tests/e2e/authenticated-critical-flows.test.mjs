// Authenticated E2E coverage for the three MVP-critical user journeys:
//
//   1. Sign in -> create a lead -> open its detail page -> add a follow-up
//      task from the lead -> mark that task complete from the Tasks page ->
//      verify the lead detail page reflects the completed task.
//   2. Create a lead -> convert it into a deal (the only lead-conversion UI
//      that exists today; it provisions a contact and company as part of
//      the same action) -> verify the resulting contact/company/deal are
//      linked -> create a second, independent deal from that company and
//      contact through the normal "Add Deal" form.
//   3. Use the global "Search CRM" command palette to find a lead by name ->
//      apply the "Filter by tag" filter on the Leads list -> verify the
//      filtered results -> open the lead detail page and confirm its
//      activity timeline loads -> perform the workspace's bulk action
//      (bulk tag assignment, the only multi-record action the UI offers;
//      there is no bulk archive yet) across selected leads.
//
// Each test provisions its own disposable, uniquely-named records through
// the real UI (no direct inserts for the entities under test) against the
// local Supabase stack, and removes everything it created in a `finally`
// block so repeat runs stay idempotent. Run with:
//
//   npm run test:e2e:auth
//
// This requires a running local Supabase stack (`npx supabase start`) with
// `supabase/seed.sql` applied (`npx supabase db reset`), matching the setup
// documented in TESTING.md and supabase/DEMO_SEED.md.
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
const timeoutMs = 60_000;

function readStatusValue(output, name) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  const rawValue = line.slice(name.length + 1).trim();
  return rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
}

function getLocalSupabaseConfig() {
  let statusOutput;
  try {
    statusOutput = execFileSync("npx", ["--yes", "supabase", "status", "-o", "env"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000,
    });
  } catch {
    throw new Error("Could not read local Supabase CLI status; start the disposable local Supabase stack first.");
  }
  let api;
  try { api = new URL(readStatusValue(statusOutput, "API_URL")); }
  catch { throw new Error("Local Supabase CLI status did not provide a valid API_URL."); }
  if (api.protocol !== "http:" || api.username || api.password || !loopbackHosts.has(api.hostname)) {
    throw new Error("Authenticated E2E requires a loopback HTTP Supabase API_URL.");
  }
  const anonKey = readStatusValue(statusOutput, "ANON_KEY");
  const serviceRoleKey = readStatusValue(statusOutput, "SERVICE_ROLE_KEY");
  if (!anonKey || !serviceRoleKey) throw new Error("Local Supabase CLI status did not provide local Auth configuration.");
  return { apiUrl: api.origin, anonKey, serviceRoleKey };
}

function createSupabase(apiUrl, key) {
  return createClient(apiUrl, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

async function provisionManager(admin, password) {
  const { error } = await admin.auth.admin.updateUserById(manager.id, { password, email_confirm: true });
  if (error) throw new Error("Could not provision the seeded manager through the local Auth admin API.");
}

async function login(page, origin, email, password) {
  await page.goto(`${origin}/auth/sign-in`);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app/"), { timeout: 30_000 });
}

async function rowBy(admin, table, column, value) {
  const { data, error } = await admin.from(table).select("*").eq("workspace_id", workspaceId).eq(column, value).single();
  assert.ifError(error);
  assert.ok(data, `expected persisted ${table}.${column}=${value}`);
  return data;
}

async function ensureWorkspaceTag(admin, name) {
  const existing = await admin.from("tags").select("id,name").eq("workspace_id", workspaceId).eq("name", name).maybeSingle();
  assert.ifError(existing.error);
  if (existing.data) return existing.data;
  const created = await admin.from("tags").insert({ workspace_id: workspaceId, name }).select("id,name").single();
  assert.ifError(created.error);
  return created.data;
}

async function cleanupRecords(admin, { leadNames = [], contactEmails = [], companyNames = [], dealTitles = [], taskTitles = [], tagNames = [] } = {}) {
  const [leadRows, contactRows, companyRows, dealRows, taskRows, tagRows] = await Promise.all([
    leadNames.length ? admin.from("leads").select("id").eq("workspace_id", workspaceId).in("full_name", leadNames) : { data: [] },
    contactEmails.length ? admin.from("contacts").select("id").eq("workspace_id", workspaceId).in("email", contactEmails) : { data: [] },
    companyNames.length ? admin.from("companies").select("id").eq("workspace_id", workspaceId).in("name", companyNames) : { data: [] },
    dealTitles.length ? admin.from("deals").select("id").eq("workspace_id", workspaceId).in("title", dealTitles) : { data: [] },
    taskTitles.length ? admin.from("tasks").select("id").eq("workspace_id", workspaceId).in("title", taskTitles) : { data: [] },
    tagNames.length ? admin.from("tags").select("id").eq("workspace_id", workspaceId).in("name", tagNames) : { data: [] },
  ]);
  for (const result of [leadRows, contactRows, companyRows, dealRows, taskRows, tagRows]) {
    if (result.error) throw new Error("Could not identify disposable E2E records for cleanup.");
  }
  const leadIds = (leadRows.data ?? []).map(({ id }) => id);
  const contactIds = (contactRows.data ?? []).map(({ id }) => id);
  const companyIds = (companyRows.data ?? []).map(({ id }) => id);
  const dealIds = (dealRows.data ?? []).map(({ id }) => id);
  const taskIds = (taskRows.data ?? []).map(({ id }) => id);
  const tagIds = (tagRows.data ?? []).map(({ id }) => id);
  const relatedIds = [...leadIds, ...contactIds, ...companyIds, ...dealIds];

  if (relatedIds.length) {
    const { error } = await admin.from("activities").delete().eq("workspace_id", workspaceId).in("related_entity_id", relatedIds);
    if (error) throw new Error("Could not clean up E2E activity records.");
  }
  if (taskIds.length) {
    const { error } = await admin.from("tasks").delete().eq("workspace_id", workspaceId).in("id", taskIds);
    if (error) throw new Error("Could not clean up E2E task records.");
  }
  if (dealIds.length) {
    const { error } = await admin.from("deals").delete().eq("workspace_id", workspaceId).in("id", dealIds);
    if (error) throw new Error("Could not clean up E2E deal records.");
  }
  if (contactIds.length) {
    const { error } = await admin.from("contacts").delete().eq("workspace_id", workspaceId).in("id", contactIds);
    if (error) throw new Error("Could not clean up E2E contact records.");
  }
  if (companyIds.length) {
    const { error } = await admin.from("companies").delete().eq("workspace_id", workspaceId).in("id", companyIds);
    if (error) throw new Error("Could not clean up E2E company records.");
  }
  if (leadIds.length) {
    const { error } = await admin.from("leads").delete().eq("workspace_id", workspaceId).in("id", leadIds);
    if (error) throw new Error("Could not clean up E2E lead records.");
  }
  if (tagIds.length) {
    const { error } = await admin.from("tags").delete().eq("workspace_id", workspaceId).in("id", tagIds);
    if (error) throw new Error("Could not clean up E2E tag records.");
  }
}

// Flow 1: Sign in -> create lead -> open lead detail -> add task -> complete task.
test("manager creates a lead, adds a follow-up task from its detail page, and completes it", { timeout: timeoutMs }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = getLocalSupabaseConfig();
  const admin = createSupabase(apiUrl, serviceRoleKey);
  const ephemeralPassword = randomBytes(32).toString("base64url");
  const runId = randomBytes(8).toString("hex");
  const leadName = `E2E flow1 lead ${runId}`;
  const taskTitle = `E2E flow1 follow-up ${runId}`;
  let browser;
  let testError;
  try {
    await provisionManager(admin, ephemeralPassword);
    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Sign in as the seeded manager.
      await login(page, origin, manager.email, ephemeralPassword);

      // Create a lead through the real "Add Lead" form.
      await page.goto(`${origin}/app/leads`);
      await page.getByRole("button", { name: "Add Lead" }).click();
      await page.getByLabel("Full name").fill(leadName);
      await page.getByRole("button", { name: "Add lead", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const lead = await rowBy(admin, "leads", "full_name", leadName);
      assert.equal(lead.status, "new");

      // Open the lead detail page.
      await page.goto(`${origin}/app/leads/${lead.id}`);
      await page.getByRole("heading", { name: leadName, exact: true }).waitFor();
      await page.getByRole("region", { name: "Lead information" }).waitFor();

      // Add a follow-up task directly from the lead detail page.
      await page.getByText("Add follow-up task").click();
      await page.getByLabel("Task title").fill(taskTitle);
      await page.getByRole("button", { name: "Create task" }).click();
      await page.getByRole("region", { name: "Lead tasks" }).getByText(taskTitle).waitFor();
      const task = await rowBy(admin, "tasks", "title", taskTitle);
      assert.equal(task.status, "open");
      assert.equal(task.related_entity_type, "lead");
      assert.equal(task.related_entity_id, lead.id);

      // Mark the task complete from the Tasks page.
      await page.goto(`${origin}/app/tasks?view=all`);
      await page.getByRole("row").filter({ hasText: taskTitle }).waitFor();
      await page.getByRole("button", { name: `Complete ${taskTitle}` }).click();
      await page.getByRole("status").filter({ hasText: "Task" }).waitFor();
      const completedTask = await rowBy(admin, "tasks", "title", taskTitle);
      assert.equal(completedTask.status, "completed");
      assert.ok(completedTask.completed_at, "completed task should record a completion timestamp");

      // Verify the lead detail page reflects the completed task.
      await page.goto(`${origin}/app/leads/${lead.id}`);
      const taskRow = page.getByRole("region", { name: "Lead tasks" }).getByRole("listitem").filter({ hasText: taskTitle });
      await taskRow.waitFor();
      await taskRow.getByText("completed", { exact: true }).waitFor();

      await context.close();
    }, [anonKey, serviceRoleKey, ephemeralPassword]);
  } catch (error) {
    testError = error;
  } finally {
    if (browser) await browser.close();
    try { await cleanupRecords(admin, { leadNames: [leadName], taskTitles: [taskTitle] }); }
    catch (cleanupError) { if (!testError) testError = cleanupError; }
  }
  if (testError) throw testError;
});

// Flow 2: Create lead -> convert to deal (provisioning a linked contact and
// company) -> create a second, independent deal from that company/contact.
test("manager converts a lead into a linked contact, company, and deal, then creates a second deal from them", { timeout: timeoutMs }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = getLocalSupabaseConfig();
  const admin = createSupabase(apiUrl, serviceRoleKey);
  const ephemeralPassword = randomBytes(32).toString("base64url");
  const runId = randomBytes(8).toString("hex");
  const leadName = `E2E flow2 lead ${runId}`;
  const convertedCompanyName = `E2E flow2 converted company ${runId}`;
  const convertedContactEmail = `e2e-flow2-${runId}@example.invalid`;
  const convertedDealTitle = `E2E flow2 converted deal ${runId}`;
  const secondDealTitle = `E2E flow2 second deal ${runId}`;
  let browser;
  let testError;
  try {
    await provisionManager(admin, ephemeralPassword);
    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, origin, manager.email, ephemeralPassword);

      // Create a lead to convert.
      await page.goto(`${origin}/app/leads`);
      await page.getByRole("button", { name: "Add Lead" }).click();
      await page.getByLabel("Full name").fill(leadName);
      await page.getByRole("textbox", { name: "Email" }).fill(convertedContactEmail);
      await page.getByRole("textbox", { name: "Company" }).fill(convertedCompanyName);
      await page.getByRole("button", { name: "Add lead", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await rowBy(admin, "leads", "full_name", leadName);

      // Convert the lead: this is the only lead-conversion UI in the app
      // today, and it provisions the linked contact and company as part of
      // the same action (there is no separate "convert to contact" step).
      await page.goto(`${origin}/app/leads?q=${encodeURIComponent(leadName)}`);
      await page.getByRole("button", { name: `Convert ${leadName}` }).click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      await page.getByRole("dialog").getByLabel("Deal name").fill(convertedDealTitle);
      await page.getByRole("button", { name: "Convert lead" }).click();
      await page.waitForURL(/\/app\/deals\//, { timeout: 30_000 });

      const convertedLead = await rowBy(admin, "leads", "full_name", leadName);
      assert.equal(convertedLead.status, "converted");
      const deal = await rowBy(admin, "deals", "title", convertedDealTitle);
      assert.ok(deal.company_id && deal.primary_contact_id, "conversion should persist a linked company and contact");
      const company = await rowBy(admin, "companies", "id", deal.company_id);
      assert.equal(company.name, convertedCompanyName);
      const contact = await rowBy(admin, "contacts", "id", deal.primary_contact_id);
      assert.equal(contact.email, convertedContactEmail);
      assert.equal(contact.company_id, company.id, "the converted contact should be linked to the converted company");

      // Verify the contact detail page shows the linked company.
      await page.goto(`${origin}/app/contacts/${contact.id}`);
      await page.getByRole("heading", { name: new RegExp(leadName.split(" ")[0]) }).first().waitFor();
      await page.locator("#company").getByText(convertedCompanyName).waitFor();

      // Create a second, independent deal from that same company and contact
      // through the normal "Add Deal" form.
      await page.goto(`${origin}/app/deals`);
      await page.getByRole("button", { name: "Add Deal" }).click();
      const dealDialog = page.getByRole("dialog");
      await dealDialog.getByLabel("Deal name").fill(secondDealTitle);
      await dealDialog.getByLabel("Company").selectOption(company.id);
      await dealDialog.getByLabel("Primary contact").selectOption(contact.id);
      await dealDialog.getByLabel("Deal value").fill("1500");
      await dealDialog.getByRole("button", { name: "Add deal", exact: true }).click();
      await dealDialog.waitFor({ state: "detached" });

      const secondDeal = await rowBy(admin, "deals", "title", secondDealTitle);
      assert.equal(secondDeal.company_id, company.id);
      assert.equal(secondDeal.primary_contact_id, contact.id);
      assert.equal(Number(secondDeal.amount), 1500);

      await context.close();
    }, [anonKey, serviceRoleKey, ephemeralPassword]);
  } catch (error) {
    testError = error;
  } finally {
    if (browser) await browser.close();
    try {
      await cleanupRecords(admin, {
        leadNames: [leadName],
        contactEmails: [convertedContactEmail],
        companyNames: [convertedCompanyName],
        dealTitles: [convertedDealTitle, secondDealTitle],
      });
    } catch (cleanupError) { if (!testError) testError = cleanupError; }
  }
  if (testError) throw testError;
});

// Flow 3: Global search -> tag filter -> filtered results -> engagement
// timeline -> bulk action (bulk tag assignment; the app has no bulk archive).
test("manager finds a lead through global search, filters by tag, and bulk-tags selected leads", { timeout: timeoutMs }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = getLocalSupabaseConfig();
  const admin = createSupabase(apiUrl, serviceRoleKey);
  const ephemeralPassword = randomBytes(32).toString("base64url");
  const runId = randomBytes(8).toString("hex");
  const leadName = `E2E flow3 lead ${runId}`;
  const otherLeadName = `E2E flow3 other lead ${runId}`;
  const tagName = `E2E flow3 tag ${runId}`;
  let browser;
  let testError;
  let tag;
  try {
    await provisionManager(admin, ephemeralPassword);
    tag = await ensureWorkspaceTag(admin, tagName);
    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, origin, manager.email, ephemeralPassword);

      // Create two leads: only one will be tagged, to prove the tag filter narrows results.
      for (const name of [leadName, otherLeadName]) {
        await page.goto(`${origin}/app/leads`);
        await page.getByRole("button", { name: "Add Lead" }).click();
        await page.getByLabel("Full name").fill(name);
        await page.getByRole("button", { name: "Add lead", exact: true }).click();
        await page.getByRole("dialog").waitFor({ state: "detached" });
      }
      const lead = await rowBy(admin, "leads", "full_name", leadName);
      await rowBy(admin, "leads", "full_name", otherLeadName);

      // Use global search to find the lead by name.
      await page.goto(`${origin}/app/leads`);
      await page.getByRole("button", { name: "Search CRM" }).click();
      await page.getByRole("searchbox", { name: "Search this workspace" }).fill(leadName);
      const searchResult = page.getByRole("dialog").getByRole("region", { name: "Leads" }).getByRole("link", { name: new RegExp(leadName) });
      await searchResult.waitFor();
      await searchResult.click();
      await page.waitForURL(`${origin}/app/leads/${lead.id}`);
      await page.getByRole("heading", { name: leadName, exact: true }).waitFor();

      // Verify the lead's activity timeline loads on its detail page.
      const timeline = page.getByRole("region", { name: "Lead activity timeline" });
      await timeline.waitFor();
      await timeline.getByText("record_created".replaceAll("_", " "), { exact: false }).first().waitFor().catch(() => {});

      // Select this lead and apply the bulk "Add tag" action (the only
      // multi-record bulk action currently available in the app).
      await page.goto(`${origin}/app/leads?q=${encodeURIComponent(leadName)}`);
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await page.getByRole("row").filter({ hasText: leadName }).waitFor();
      await page.getByLabel(`Select ${leadName}`).check();
      await page.getByLabel("Add tag to selected leads").selectOption(tag.id);
      await page.getByRole("button", { name: "Add tag" }).click();
      await page.getByText(`${1} selected on this page`).waitFor({ state: "detached" }).catch(() => {});

      const leadTags = await admin.from("entity_tags").select("tag_id").eq("workspace_id", workspaceId).eq("entity_type", "lead").eq("entity_id", lead.id);
      assert.ifError(leadTags.error);
      assert.ok(leadTags.data.some((row) => row.tag_id === tag.id), "bulk tag action should persist the tag assignment");

      // Apply the "Filter by tag" filter on the Leads list and verify it narrows results.
      await page.goto(`${origin}/app/leads`);
      await page.getByLabel("Filter by tag").selectOption(tag.id);
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await page.getByRole("row").filter({ hasText: leadName }).waitFor();
      await assert.rejects(page.getByRole("row").filter({ hasText: otherLeadName }).waitFor({ state: "visible", timeout: 1_000 }), "the untagged lead should be excluded by the tag filter");

      await context.close();
    }, [anonKey, serviceRoleKey, ephemeralPassword]);
  } catch (error) {
    testError = error;
  } finally {
    if (browser) await browser.close();
    try { await cleanupRecords(admin, { leadNames: [leadName, otherLeadName], tagNames: [tagName] }); }
    catch (cleanupError) { if (!testError) testError = cleanupError; }
  }
  if (testError) throw testError;
});
