import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { waitForResponse, withNextServer } from "./next-server.mjs";

// Run only against the disposable local Supabase stack described in supabase/DEMO_SEED.md.
const demoUsers = [
  { id: "00000000-0000-4000-8000-000000000101", email: "avery.stone@northstar-demo.example" },
  { id: "00000000-0000-4000-8000-000000000102", email: "maya.hassan@northstar-demo.example", role: "manager" },
  { id: "00000000-0000-4000-8000-000000000103", email: "omar.nabil@northstar-demo.example" },
  { id: "00000000-0000-4000-8000-000000000104", email: "lina.kareem@northstar-demo.example" },
  { id: "00000000-0000-4000-8000-000000000105", email: "sam.reed@northstar-demo.example", role: "viewer" },
];
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

function readStatusValue(statusOutput, name) {
  const line = statusOutput.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  const rawValue = line.slice(name.length + 1).trim();
  return rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
}

function getLocalSupabaseConfig() {
  let statusOutput;
  try {
    statusOutput = execFileSync("npx", ["--yes", "supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    });
  } catch {
    throw new Error("Could not read local Supabase CLI status; start the local Supabase stack first.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(readStatusValue(statusOutput, "API_URL"));
  } catch {
    throw new Error("Local Supabase CLI status did not provide a valid API_URL.");
  }

  if (parsedUrl.protocol !== "http:" || parsedUrl.username || parsedUrl.password || !loopbackHosts.has(parsedUrl.hostname)) {
    throw new Error("Authenticated E2E requires a loopback HTTP Supabase API_URL.");
  }

  const anonKey = readStatusValue(statusOutput, "ANON_KEY");
  const serviceRoleKey = readStatusValue(statusOutput, "SERVICE_ROLE_KEY");
  if (!anonKey || !serviceRoleKey) {
    throw new Error("Local Supabase CLI status did not provide the required local Auth configuration.");
  }

  return { apiUrl: parsedUrl.origin, anonKey, serviceRoleKey };
}

async function provisionDemoUsers(apiUrl, serviceRoleKey, password) {
  const adminClient = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  for (const { id } of demoUsers) {
    const { error } = await adminClient.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) {
      throw new Error("Could not provision seeded users through the local Auth admin API.");
    }
  }
}

async function signIn(apiUrl, anonKey, email, password) {
  const cookies = new Map();
  const supabase = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (updates) => updates.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error("Local demo sign-in failed; confirm the disposable demo user exists in the seeded local stack.");
  }

  const cookieHeader = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  if (!cookieHeader) throw new Error("Local demo sign-in did not produce an SSR session cookie.");
  return cookieHeader;
}

test("local demo manager and viewer receive their authenticated lead permissions", { timeout: 180_000 }, async () => {
  const { apiUrl, anonKey, serviceRoleKey } = getLocalSupabaseConfig();
  const ephemeralPassword = randomBytes(32).toString("base64url");
  await provisionDemoUsers(apiUrl, serviceRoleKey, ephemeralPassword);
  const managerCookie = await signIn(apiUrl, anonKey, demoUsers[1].email, ephemeralPassword);
  const viewerCookie = await signIn(apiUrl, anonKey, demoUsers[4].email, ephemeralPassword);

  await withNextServer({
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  }, async ({ child, origin }) => {
    await waitForResponse(child, origin, "/auth/sign-in", 200);

    for (const [{ role }, cookie, canSelectLeads] of [
      [demoUsers[1], managerCookie, true],
      [demoUsers[4], viewerCookie, false],
    ]) {
      const response = await fetch(`${origin}/app/leads`, {
        headers: { cookie },
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.text();
      assert.equal(response.status, 200, `${role} should receive the authenticated leads page`);
      assert.match(body, /<h1[^>]*>Leads<\/h1>/, `${role} should see the leads heading`);
      if (canSelectLeads) {
        assert.match(body, /aria-label="Select all visible leads on this page"/, "manager should see lead selection controls");
      } else {
        assert.doesNotMatch(body, /aria-label="Select all visible leads on this page"/, "viewer should not see lead selection controls");
        assert.doesNotMatch(body, />Add Lead</, "viewer should not see lead creation controls");
      }
    }
  }, [anonKey, serviceRoleKey, ephemeralPassword, managerCookie, viewerCookie]);
});
