import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { waitForResponse, withNextServer } from "./next-server.mjs";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const workspaceId = "00000000-0000-4000-8000-000000000001";
const timeoutMs = 180_000;

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
    throw new Error("Could not read local Supabase CLI status; start the local Supabase stack first.");
  }

  let api;
  try { api = new URL(statusValue(output, "API_URL")); }
  catch { throw new Error("Local Supabase CLI status did not provide a valid API_URL."); }
  if (api.protocol !== "http:" || api.username || api.password || !loopbackHosts.has(api.hostname)) {
    throw new Error("Authenticated invitation E2E requires a loopback HTTP Supabase API_URL.");
  }

  const anonKey = statusValue(output, "ANON_KEY");
  const serviceRoleKey = statusValue(output, "SERVICE_ROLE_KEY");
  if (!anonKey || !serviceRoleKey) throw new Error("Local Supabase CLI status did not provide local Auth configuration.");
  return { apiUrl: api.origin, anonKey, serviceRoleKey };
}

function createSupabase(apiUrl, key) {
  return createClient(apiUrl, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

async function createTemporaryUser(admin, email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `E2E ${email}` },
  });
  if (error || !data.user) throw new Error("Could not create a temporary Auth user on local Supabase.");
  return data.user.id;
}

async function signIn(page, origin, email, password) {
  await page.goto(`${origin}/auth/sign-in`);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app/"), { timeout: 30_000 });
}

async function createInvitation(page, email, role = "member") {
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Workspace role").selectOption(role);
  await page.getByRole("button", { name: "Create invitation" }).click();
  await page.getByRole("status").filter({ hasText: "Invitation created." }).waitFor();
  const link = await page.getByLabel("One-time invitation link").inputValue();
  assert.ok(link, "the UI should reveal the one-time invitation link");
  return link;
}

async function invitationRow(admin, email) {
  const { data, error } = await admin.from("workspace_invites").select("id,email,role,accepted_at,revoked_at,token_hash")
    .eq("workspace_id", workspaceId).eq("email", email).single();
  assert.ifError(error);
  return data;
}

async function acceptInvitation(page, link) {
  await page.goto(link);
  await page.getByRole("heading", { name: "Accept invitation" }).waitFor();
  await page.getByRole("button", { name: "Accept invitation" }).click();
}

test("authenticated invitation UI creates, rejects mismatched identity, accepts once, and revokes unused links", { timeout: timeoutMs }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = localSupabaseConfig();
  const admin = createSupabase(apiUrl, serviceRoleKey);
  const password = randomBytes(32).toString("base64url");
  const runId = randomBytes(10).toString("hex");
  const emails = {
    administrator: `e2e-invite-admin-${runId}@example.invalid`,
    invited: `e2e-invite-member-${runId}@example.invalid`,
    mismatched: `e2e-invite-mismatch-${runId}@example.invalid`,
    revoked: `e2e-invite-revoked-${runId}@example.invalid`,
  };
  const userIds = [];
  const invitationIds = [];
  let browser;
  let failure;

  try {
    const administratorId = await createTemporaryUser(admin, emails.administrator, password);
    userIds.push(administratorId);
    const invitedUserId = await createTemporaryUser(admin, emails.invited, password);
    userIds.push(invitedUserId);
    const mismatchedUserId = await createTemporaryUser(admin, emails.mismatched, password);
    userIds.push(mismatchedUserId);
    const revokedUserId = await createTemporaryUser(admin, emails.revoked, password);
    userIds.push(revokedUserId);

    const { error: membershipError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId, user_id: administratorId, role: "admin", status: "active",
    });
    if (membershipError) throw new Error("Could not grant the temporary local administrator workspace access.");

    await withNextServer({ NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, async ({ child, origin }) => {
      await waitForResponse(child, origin, "/auth/sign-in", 200);
      browser = await chromium.launch({ headless: true });
      const administratorContext = await browser.newContext();
      const administratorPage = await administratorContext.newPage();
      await signIn(administratorPage, origin, emails.administrator, password);
      await administratorPage.goto(`${origin}/app/settings/users`);
      await administratorPage.getByRole("heading", { name: "Invite a teammate" }).waitFor();

      const acceptedLink = await createInvitation(administratorPage, emails.invited, "member");
      assert.equal(new URL(acceptedLink).origin, origin, "the UI link must target the local application server");
      const acceptedInvite = await invitationRow(admin, emails.invited);
      invitationIds.push(acceptedInvite.id);
      assert.equal(acceptedInvite.role, "member");

      const mismatchContext = await browser.newContext();
      const mismatchPage = await mismatchContext.newPage();
      await signIn(mismatchPage, origin, emails.mismatched, password);
      await acceptInvitation(mismatchPage, acceptedLink);
      await mismatchPage.getByRole("alert").filter({ hasText: "Sign in with the email address that received this invitation." }).waitFor();
      const stillPending = await invitationRow(admin, emails.invited);
      assert.equal(stillPending.accepted_at, null, "a mismatched authenticated email must not consume the invitation");
      const mismatchMembership = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", mismatchedUserId).maybeSingle();
      assert.ifError(mismatchMembership.error);
      assert.equal(mismatchMembership.data, null, "a mismatched account must not become a workspace member");
      await mismatchContext.close();

      const invitedContext = await browser.newContext();
      const invitedPage = await invitedContext.newPage();
      await signIn(invitedPage, origin, emails.invited, password);
      await acceptInvitation(invitedPage, acceptedLink);
      await invitedPage.waitForURL(`${origin}/app/dashboard`, { timeout: 30_000 });
      const acceptedMembership = await admin.from("workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", invitedUserId).single();
      assert.ifError(acceptedMembership.error);
      assert.deepEqual(acceptedMembership.data, { role: "member", status: "active" });
      const accepted = await invitationRow(admin, emails.invited);
      assert.ok(accepted.accepted_at, "successful acceptance should persist its timestamp");
      assert.equal(accepted.revoked_at, null);

      await acceptInvitation(invitedPage, acceptedLink);
      await invitedPage.getByRole("alert").filter({ hasText: "This invitation has expired or was already used." }).waitFor();

      const revokedLink = await createInvitation(administratorPage, emails.revoked, "viewer");
      await administratorPage.getByRole("row").filter({ hasText: emails.revoked }).waitFor();
      const revokedInvite = await invitationRow(admin, emails.revoked);
      invitationIds.push(revokedInvite.id);
      const inviteRow = administratorPage.getByRole("row").filter({ hasText: emails.revoked });
      await inviteRow.getByRole("button", { name: "Revoke" }).click();
      await inviteRow.getByText("Revoked", { exact: true }).waitFor();
      const revoked = await invitationRow(admin, emails.revoked);
      assert.ok(revoked.revoked_at, "revocation should persist its timestamp");
      assert.equal(revoked.accepted_at, null);

      const revokedContext = await browser.newContext();
      const revokedPage = await revokedContext.newPage();
      await signIn(revokedPage, origin, emails.revoked, password);
      await acceptInvitation(revokedPage, revokedLink);
      await revokedPage.getByRole("alert").filter({ hasText: "This invitation has expired or was already used." }).waitFor();
      const revokedMembership = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", revokedUserId).maybeSingle();
      assert.ifError(revokedMembership.error);
      assert.equal(revokedMembership.data, null, "a revoked invitation must not create a membership");

      await revokedContext.close();
      await invitedContext.close();
      await administratorContext.close();
    }, [anonKey, serviceRoleKey, password]);
  } catch (error) {
    failure = error;
  } finally {
    if (browser) {
      try { await browser.close(); }
      catch (closeError) { if (!failure) failure = closeError; }
    }
    const cleanupErrors = [];
    // Include rows found by unique test-owned email in case setup stopped before recording their ids.
    const { data: testInvites, error: selectError } = await admin.from("workspace_invites").select("id")
      .eq("workspace_id", workspaceId).in("email", [emails.invited, emails.revoked]);
    if (selectError) cleanupErrors.push(new Error("Could not identify temporary invitation rows for cleanup."));
    const allInvitationIds = [...new Set([...invitationIds, ...(testInvites ?? []).map(({ id }) => id)])];
    if (allInvitationIds.length) {
      const { error } = await admin.from("workspace_invites").delete().eq("workspace_id", workspaceId).in("id", allInvitationIds);
      if (error) cleanupErrors.push(new Error("Could not clean up temporary invitation rows."));
    }
    if (userIds.length) {
      const { error } = await admin.from("workspace_members").delete().eq("workspace_id", workspaceId).in("user_id", userIds);
      if (error) cleanupErrors.push(new Error("Could not clean up temporary workspace membership rows."));
    }
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) cleanupErrors.push(new Error("Could not clean up a temporary local Auth user."));
    }
    if (!failure && cleanupErrors.length) failure = cleanupErrors[0];
  }

  if (failure) throw failure;
});
