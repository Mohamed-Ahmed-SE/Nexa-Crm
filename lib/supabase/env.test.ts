import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnvironment } from "@/lib/supabase/env";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase environment validation", () => {
  it("returns public client configuration for secure project and site origins", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-placeholder");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.com");

    expect(getSupabaseEnvironment()).toEqual({
      url: "https://project.example.supabase.co",
      anonKey: "public-anon-placeholder",
      siteUrl: "https://crm.example.com",
    });
  });

  it.each([
    ["http://project.example.supabase.co", "https://crm.example.com"],
    ["https://project.example.supabase.co/path", "https://crm.example.com"],
    ["https://project.example.supabase.co", "https://crm.example.com/path"],
    ["https://project.example.supabase.co", "http://crm.example.com"],
  ])("fails closed for insecure or malformed origins", (projectUrl, siteUrl) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", projectUrl);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-placeholder");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);

    expect(getSupabaseEnvironment()).toBeNull();
  });

  it("fails closed when public credentials are absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.com");

    expect(getSupabaseEnvironment()).toBeNull();
  });
});
