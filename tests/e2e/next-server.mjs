import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

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

export async function waitForResponse(child, origin, path, expectedStatus) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastStatus;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${origin}${path}`, {
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

  throw new Error(`Timed out waiting for ${path} (last HTTP status: ${lastStatus ?? "no response"}).`);
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

export async function withNextServer(extraEnv, run, secretValues = []) {
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
    const diagnostics = secretValues.reduce(
      (output, secret) => secret ? output.split(secret).join("[redacted]") : output,
      capturedOutput.trim(),
    );
    throw new Error(
      `${error instanceof Error ? error.message : "E2E request failed."}${diagnostics ? `\nNext dev server output:\n${diagnostics}` : ""}`,
      { cause: error },
    );
  } finally {
    await stopServer(child);
  }
}
