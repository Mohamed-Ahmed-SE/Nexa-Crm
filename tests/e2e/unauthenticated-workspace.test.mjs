import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const startupTimeoutMs = 120_000;
const responseTimeoutMs = 5_000;
const maxCapturedOutputLength = 20_000;

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function appendOutput(current, chunk) {
  return `${current}${chunk}`.slice(-maxCapturedOutputLength);
}

async function waitForResponse(child, origin, expectedStatus) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastStatus;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${origin}/app/dashboard`, {
        redirect: "manual",
        signal: AbortSignal.timeout(responseTimeoutMs),
      });
      lastStatus = response.status;
      const body = await response.text();
      if (response.status === expectedStatus) return { response, body };
    } catch (error) {
      if (child.exitCode !== null) {
        throw new Error(`Next dev server exited with code ${child.exitCode}.`, { cause: error });
      }
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for /app/dashboard (last HTTP status: ${lastStatus ?? "no response"}).`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exit = once(child, "exit");
  child.kill("SIGTERM");
  let stopped = await Promise.race([
    exit.then(() => true),
    delay(5_000).then(() => false),
  ]);

  if (!stopped) {
    child.kill("SIGKILL");
    stopped = await Promise.race([
      exit.then(() => true),
      delay(2_000).then(() => false),
    ]);
  }

  if (!stopped) throw new Error("Next dev server did not stop after SIGTERM and SIGKILL.");
}

async function withNextServer(extraEnv, run) {
  const port = await getAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  const childEnv = {
    ...process.env,
    ...extraEnv,
    NEXT_PUBLIC_SITE_URL: origin,
  };
  childEnv.SUPABASE_SERVICE_ROLE_KEY = "";
  childEnv.SUPABASE_SECRET_KEY = "";

  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: projectRoot, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
  );

  let capturedOutput = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    capturedOutput = appendOutput(capturedOutput, chunk);
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    capturedOutput = appendOutput(capturedOutput, chunk);
  });

  try {
    return await run({ child, origin });
  } catch (error) {
    const diagnostics = capturedOutput.trim();
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}${diagnostics ? `\nNext dev server output:\n${diagnostics}` : ""}`,
      { cause: error },
    );
  } finally {
    await stopServer(child);
  }
}

test("unauthenticated workspace request serves setup notice without dashboard content", { timeout: 150_000 }, async () => {
  await withNextServer({
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  }, async ({ child, origin }) => {
    const { response, body } = await waitForResponse(child, origin, 200);
    assert.equal(response.status, 200, "workspace request should return the setup notice successfully");
    assert.match(body, /Supabase setup required/, "setup notice should be visible");
    assert.doesNotMatch(body, /Sales Dashboard|Sample demo workspace|Deal overview/, "workspace dashboard content must not render");
  });
});

test("public demo routes render fictional read-only content without Supabase configuration", { timeout: 150_000 }, async () => {
  const routes = [
    {
      path: "/demo",
      heading: "Sales Dashboard",
      content: /Deal overview[\s\S]*Platform redesign/,
      notice: /Sample demo workspace[\s\S]*Fictional records for preview only — not live customer data\. Nothing here is saved\./,
    },
    {
      path: "/demo/leads",
      heading: "Leads",
      content: /Fictional demo leads[\s\S]*Aiden Brooks/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/contacts",
      heading: "Contacts",
      content: /Fictional demo contacts[\s\S]*Sarah Chen/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/contacts/c1",
      heading: "Sarah Chen",
      content: /sarah\.chen@lunacommerce\.example\.com[\s\S]*Platform redesign[\s\S]*Company-related tasks/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/companies",
      heading: "Companies",
      content: /Fictional demo companies[\s\S]*Luna Commerce/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/deals",
      heading: "Deals",
      content: /Fictional demo deals[\s\S]*Platform redesign/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/tasks",
      heading: "Tasks",
      content: /Fictional demo tasks[\s\S]*Prepare discovery agenda/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
    {
      path: "/demo/reports",
      heading: "Reports",
      content: /Total deals[\s\S]*Pipeline by stage/,
      notice: /Fictional sample workspace[\s\S]*All records are fictional\. Changes are not saved\./,
    },
  ];

  await withNextServer({
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  }, async ({ child, origin }) => {
    await waitForResponse(child, origin, 200);

    for (const { path, heading, content, notice } of routes) {
      const response = await fetch(`${origin}${path}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(responseTimeoutMs),
      });
      const body = await response.text();

      assert.equal(response.status, 200, `${path} should be publicly available without a sign-in redirect`);
      assert.match(body, new RegExp(`<h1[^>]*>${heading}</h1>`), `${path} should show its page heading`);
      assert.match(body, content, `${path} should show populated demo content`);
      assert.match(body, notice, `${path} should explain the fictional/read-only sample data`);
    }

    const unknownContact = await fetch(`${origin}/demo/contacts/unknown-contact`, {
      redirect: "manual",
      signal: AbortSignal.timeout(responseTimeoutMs),
    });
    assert.equal(unknownContact.status, 404, "unknown demo contacts should not render a detail page");
  });
});
