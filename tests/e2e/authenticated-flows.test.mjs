import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { waitForResponse, withNextServer } from "./next-server.mjs";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const manager = { id: "00000000-0000-4000-8000-000000000102", email: "maya.hassan@northstar-demo.example" };
const viewer = { id: "00000000-0000-4000-8000-000000000105", email: "sam.reed@northstar-demo.example" };
const workspaceId = "00000000-0000-4000-8000-000000000001";
const timeoutMs = 180_000;

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

async function provisionUsers(admin, password) {
  for (const { id } of [manager, viewer]) {
    const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) throw new Error("Could not provision seeded users through the local Auth admin API.");
  }
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

async function waitForDealValue(admin, dealId, column, expected) {
  const deadline = Date.now() + 15_000;
  let current;
  while (Date.now() < deadline) {
    const { data, error } = await admin.from("deals").select(column).eq("workspace_id", workspaceId).eq("id", dealId).single();
    assert.ifError(error);
    current = data?.[column];
    if (current === expected) return;
    await delay(250);
  }
  assert.equal(current, expected, `deal ${column} should persist as ${expected}`);
}

async function removeMatching(admin, table, column, values) {
  if (!values.length) return;
  const { error } = await admin.from(table).delete().eq("workspace_id", workspaceId).in(column, values);
  if (error) throw new Error(`Could not clean up E2E ${table} records.`);
}

async function cleanup(admin, data) {
  const [leadRows, contactRows, companyRows, dealRows, taskRows] = await Promise.all([
    admin.from("leads").select("id").eq("workspace_id", workspaceId).in("full_name", [data.leadName, data.importedLeadName]),
    admin.from("contacts").select("id").eq("workspace_id", workspaceId).in("email", [data.contactEmail, data.convertedEmail]),
    admin.from("companies").select("id").eq("workspace_id", workspaceId).in("name", [data.companyName, data.convertedCompanyName]),
    admin.from("deals").select("id").eq("workspace_id", workspaceId).eq("title", data.dealTitle),
    admin.from("tasks").select("id").eq("workspace_id", workspaceId).eq("title", data.taskTitle),
  ]);
  for (const result of [leadRows, contactRows, companyRows, dealRows, taskRows]) {
    if (result.error) throw new Error("Could not identify disposable E2E records for cleanup.");
  }
  const leadIds = (leadRows.data ?? []).map(({ id }) => id);
  const contactIds = (contactRows.data ?? []).map(({ id }) => id);
  const companyIds = (companyRows.data ?? []).map(({ id }) => id);
  const dealIds = (dealRows.data ?? []).map(({ id }) => id);
  const taskIds = (taskRows.data ?? []).map(({ id }) => id);
  const relatedIds = [...leadIds, ...contactIds, ...companyIds, ...dealIds];

  if (relatedIds.length) {
    const { error } = await admin.from("activities").delete().eq("workspace_id", workspaceId).in("related_entity_id", relatedIds);
    if (error) throw new Error("Could not clean up E2E activity records.");
  }
  await removeMatching(admin, "tasks", "id", taskIds);
  await removeMatching(admin, "deals", "id", dealIds);
  await removeMatching(admin, "contacts", "id", contactIds);
  await removeMatching(admin, "companies", "id", companyIds);
  await removeMatching(admin, "leads", "id", leadIds);
}

test("manager completes authenticated CRM journeys with persisted local outcomes and viewer writes are rejected", { timeout: timeoutMs }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = getLocalSupabaseConfig();
  const ephemeralPassword = randomBytes(32).toString("base64url");
  const runId = randomBytes(8).toString("hex");
  const label = `E2E ${runId}`;
  const data = {
    leadName: `${label} conversion lead`, importedLeadName: `${label} CSV lead`,
    companyName: `${label} company`, convertedCompanyName: `${label} converted company`,
    contactEmail: `e2e-${runId}@example.invalid`, convertedEmail: `e2e-converted-${runId}@example.invalid`,
    dealTitle: `${label} converted deal`, taskTitle: `${label} follow-up`, activityTitle: `${label} discovery call`,
  };
  const admin = createSupabase(apiUrl, serviceRoleKey);
  let browser;
  let usersProvisioned = false;
  let testError;
  try {
    await provisionUsers(admin, ephemeralPassword);
    usersProvisioned = true;
    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const managerContext = await browser.newContext();
      const page = await managerContext.newPage();
      await login(page, origin, manager.email, ephemeralPassword);

      // Create a lead, then observe its database row and exercise server-rendered search/filtering.
      await page.goto(`${origin}/app/leads`);
      await page.getByRole("button", { name: "Add Lead" }).click();
      await page.getByLabel("Full name").fill(data.leadName);
      await page.getByRole("textbox", { name: "Email" }).fill(data.convertedEmail);
      await page.getByRole("textbox", { name: "Company" }).fill(data.convertedCompanyName);
      await page.getByRole("button", { name: "Add lead", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const lead = await rowBy(admin, "leads", "full_name", data.leadName);
      assert.equal(lead.status, "new");
      const creationActivity = await admin.from("activities").select("id").eq("related_entity_type", "lead").eq("related_entity_id", lead.id).eq("activity_type", "record_created").maybeSingle();
      assert.ok(creationActivity.data, "lead creation should persist its audit activity");

      await page.getByPlaceholder("Search leads by name, company, or email").fill(data.leadName);
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await page.getByRole("row").filter({ hasText: data.leadName }).waitFor();
      await page.getByLabel("Filter by status").selectOption("contacted");
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await assert.rejects(page.getByRole("row").filter({ hasText: data.leadName }).waitFor({ state: "visible", timeout: 1_000 }));
      await page.getByLabel("Filter by status").selectOption("new");
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await page.getByRole("row").filter({ hasText: data.leadName }).waitFor();

      // Create a company and contact through their actual workspace forms.
      await page.goto(`${origin}/app/companies`);
      await page.getByRole("button", { name: "Add company" }).click();
      await page.getByLabel("Company name").fill(data.companyName);
      await page.getByRole("button", { name: "Add company", exact: true }).last().click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const company = await rowBy(admin, "companies", "name", data.companyName);

      await page.goto(`${origin}/app/contacts`);
      await page.getByRole("button", { name: "Add Contact" }).click();
      await page.getByLabel("First name").fill(`${label} Contact`);
      await page.getByLabel("Last name").fill("Person");
      await page.getByRole("textbox", { name: "Email" }).fill(data.contactEmail);
      await page.getByRole("dialog").getByRole("combobox", { name: "Company" }).selectOption(company.id);
      await page.getByRole("button", { name: "Add contact", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const contact = await rowBy(admin, "contacts", "email", data.contactEmail);
      assert.equal(contact.company_id, company.id);

      // Log activity from the contact detail page and assert the persisted event.
      await page.goto(`${origin}/app/contacts/${contact.id}`);
      await page.getByRole("button", { name: "Log activity" }).first().click();
      await page.getByLabel("Subject").fill(data.activityTitle);
      await page.getByLabel("Description").fill("Authenticated E2E activity persisted through the app.");
      await page.getByRole("button", { name: "Log activity", exact: true }).last().click();
      await page.getByText(data.activityTitle).waitFor();
      const activityResult = await admin.from("activities").select("id,body").eq("related_entity_type", "contact").eq("related_entity_id", contact.id).eq("subject", data.activityTitle).single();
      assert.ifError(activityResult.error);
      assert.match(activityResult.data.body, /persisted through the app/);

      // Create a task in the application and verify its row is persisted.
      await page.goto(`${origin}/app/tasks`);
      await page.getByRole("button", { name: "Add Task" }).click();
      await page.getByLabel("Task title").fill(data.taskTitle);
      await page.getByRole("button", { name: "Create task" }).click();
      await page.getByText(data.taskTitle).waitFor();
      const task = await rowBy(admin, "tasks", "title", data.taskTitle);
      assert.equal(task.status, "open");

      // Convert the lead into a contact, company, and deal, then move and win the deal.
      await page.goto(`${origin}/app/leads?q=${encodeURIComponent(data.leadName)}`);
      await page.getByRole("button", { name: `Convert ${data.leadName}` }).click();
      await page.getByRole("heading", { name: `Convert ${data.leadName}`, exact: true }).waitFor();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      await page.getByRole("dialog").getByLabel("Deal name").fill(data.dealTitle);
      await page.getByRole("button", { name: "Convert lead" }).click();
      await page.waitForURL(/\/app\/deals\//, { timeout: 30_000 });
      const convertedLead = await rowBy(admin, "leads", "full_name", data.leadName);
      assert.equal(convertedLead.status, "converted");
      const deal = await rowBy(admin, "deals", "title", data.dealTitle);
      assert.ok(deal.company_id && deal.primary_contact_id, "conversion should persist linked company/contact/deal records");
      const convertedCompany = await rowBy(admin, "companies", "name", data.convertedCompanyName);
      const convertedContact = await admin.from("contacts").select("id,email").eq("workspace_id", workspaceId).eq("id", deal.primary_contact_id).single();
      assert.ifError(convertedContact.error);
      assert.equal(convertedContact.data.email, data.convertedEmail);
      assert.equal(deal.company_id, convertedCompany.id);

      // Search the linked deal from the authenticated shell and verify its contact name comes from contact name columns.
      await page.getByRole("button", { name: "Search CRM" }).click();
      await page.getByRole("searchbox", { name: "Search this workspace" }).fill(data.dealTitle);
      const globalDealResult = page.getByRole("region", { name: "Deals" }).getByRole("link").filter({ hasText: data.dealTitle });
      await globalDealResult.waitFor();
      assert.match(await globalDealResult.innerText(), new RegExp(data.leadName));
      await page.getByRole("button", { name: "Close search" }).click();

      const { data: stages, error: stagesError } = await admin.from("pipeline_stages").select("id,name,position,stage_type")
        .eq("workspace_id", workspaceId).eq("pipeline_id", deal.pipeline_id).eq("stage_type", "open").eq("is_active", true).order("position");
      assert.ifError(stagesError);
      assert.ok(stages.length > 1, "seeded pipeline should have at least two active open stages");
      const targetStage = stages.find((stage) => stage.id !== deal.stage_id);
      await page.goto(`${origin}/app/deals`);
      const moveControl = page.getByLabel(`Move ${data.dealTitle} to stage`);
      await moveControl.selectOption(targetStage.id);
      await waitForDealValue(admin, deal.id, "stage_id", targetStage.id);
      await page.goto(`${origin}/app/deals/${deal.id}`);
      await page.getByRole("heading", { name: data.dealTitle }).waitFor();
      const movedDeal = await rowBy(admin, "deals", "id", deal.id);
      assert.equal(movedDeal.stage_id, targetStage.id, "stage move should persist before marking won");
      await page.getByRole("button", { name: "Mark Won" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Mark Won" }).click();
      await page.getByRole("region", { name: "Deal overview" }).getByText("Won", { exact: true }).waitFor();
      const wonDeal = await rowBy(admin, "deals", "id", deal.id);
      assert.equal(wonDeal.status, "won");

      // Import a unique CSV lead through the file picker/mapping/import UI.
      await page.goto(`${origin}/app/data-import?entity=leads`);
      await page.locator('input[type="file"]').setInputFiles({
        name: "authenticated-e2e.csv", mimeType: "text/csv",
        buffer: Buffer.from(`Full name,Email,Company\n${data.importedLeadName},import-${runId}@example.invalid,${label} CSV Co\n`),
      });
      await page.getByRole("heading", { name: "Preview and validation" }).waitFor();
      const historyBeforeImport = await admin.from("crm_import_jobs").select("id").eq("workspace_id", workspaceId)
        .eq("created_by", manager.id).eq("entity", "leads");
      assert.ifError(historyBeforeImport.error);
      const previousHistoryIds = new Set((historyBeforeImport.data ?? []).map(({ id }) => id));
      await page.getByRole("button", { name: "Import 1 rows" }).click();
      await page.getByRole("heading", { name: "Import summary" }).waitFor();
      const importedLead = await rowBy(admin, "leads", "full_name", data.importedLeadName);
      assert.equal(importedLead.email, `import-${runId}@example.invalid`);
      const historyAfterImport = await admin.from("crm_import_jobs").select("id,imported_rows,status").eq("workspace_id", workspaceId)
        .eq("created_by", manager.id).eq("entity", "leads");
      assert.ifError(historyAfterImport.error);
      const newHistoryRows = (historyAfterImport.data ?? []).filter(({ id }) => !previousHistoryIds.has(id));
      assert.equal(newHistoryRows.length, 1, "CSV import should create exactly one new import-history row");
      assert.equal(newHistoryRows[0].imported_rows, 1);
      assert.equal(newHistoryRows[0].status, "completed");

      // UI hides writes from viewers; a forged server-side database update is independently denied by RLS.
      const viewerContext = await browser.newContext();
      const viewerPage = await viewerContext.newPage();
      await login(viewerPage, origin, viewer.email, ephemeralPassword);
      await viewerPage.goto(`${origin}/app/leads`);
      await assert.rejects(viewerPage.getByRole("button", { name: "Add Lead" }).waitFor({ state: "visible", timeout: 1_000 }));
      const viewerClient = createSupabase(apiUrl, anonKey);
      const { error: viewerSignInError } = await viewerClient.auth.signInWithPassword({ email: viewer.email, password: ephemeralPassword });
      assert.ifError(viewerSignInError);
      const { data: forbiddenUpdate, error: authorizationError } = await viewerClient.from("leads").update({ full_name: `${data.leadName} unauthorized` })
        .eq("workspace_id", workspaceId).eq("id", lead.id).select("id").maybeSingle();
      assert.ok(authorizationError || forbiddenUpdate === null, "RLS should reject the viewer write without exposing a privileged key");
      const unchangedLead = await rowBy(admin, "leads", "id", lead.id);
      assert.equal(unchangedLead.full_name, data.leadName, "denied server-side write must leave persisted lead unchanged");
      await viewerContext.close();
      await managerContext.close();
    }, [anonKey, serviceRoleKey, ephemeralPassword]);
  } catch (error) {
    testError = error;
  } finally {
    if (browser) await browser.close();
    if (usersProvisioned) {
      try { await cleanup(admin, data); }
      catch (cleanupError) {
        if (!testError) testError = cleanupError;
      }
    }
  }
  if (testError) throw testError;
});
