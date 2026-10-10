import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForResponse, withNextServer } from "./next-server.mjs";

const responseTimeoutMs = 5_000;

test("unauthenticated workspace request serves setup notice without dashboard content", { timeout: 150_000 }, async () => {
  await withNextServer({
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  }, async ({ child, origin }) => {
    const { response, body } = await waitForResponse(child, origin, "/app/dashboard", 200);
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
    await waitForResponse(child, origin, "/app/dashboard", 200);

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
