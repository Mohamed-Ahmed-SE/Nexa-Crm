import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "./page";
import { createWorkspaceAction } from "@/lib/auth/actions";

const mocks = vi.hoisted(() => {
  const pipelineQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const stageQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  const membershipQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  const workspaceQuery = {
    select: vi.fn(),
    in: vi.fn(),
  };
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      rpc: vi.fn(),
      from: vi.fn(),
    },
    queryFilters: {} as Record<string, Array<[string, unknown]>>,
    pipelineQuery,
    stageQuery,
    membershipQuery,
    workspaceQuery,
    profileQuery,
    cookieStore: { get: vi.fn(() => undefined) },
    isSupabaseConfigured: vi.fn(),
    createSupabaseServerClient: vi.fn(),
    redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: mocks.isSupabaseConfigured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

const workspaceContext = { workspaceId: "workspace-1" };
const defaultPipeline = { id: "pipeline-1", name: "Standard Sales" };
const seededStages = [
  { name: "Discovery", position: 1 },
  { name: "Qualified", position: 2 },
  { name: "Proposal", position: 3 },
  { name: "Negotiation", position: 4 },
  { name: "Won", position: 5 },
  { name: "Lost", position: 6 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryFilters = {};
  mocks.isSupabaseConfigured.mockReturnValue(true);
  mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null });
  mocks.supabase.rpc.mockResolvedValue({ error: null });
  mocks.createSupabaseServerClient.mockResolvedValue(mocks.supabase);
  mocks.pipelineQuery.select.mockReturnValue(mocks.pipelineQuery);
  mocks.pipelineQuery.eq.mockImplementation((column: string, value: unknown) => {
    (mocks.queryFilters.pipelines ??= []).push([column, value]);
    return mocks.pipelineQuery;
  });
  mocks.pipelineQuery.maybeSingle.mockResolvedValue({ data: defaultPipeline, error: null });
  mocks.stageQuery.select.mockReturnValue(mocks.stageQuery);
  mocks.stageQuery.eq.mockImplementation((column: string, value: unknown) => {
    (mocks.queryFilters.pipeline_stages ??= []).push([column, value]);
    return mocks.stageQuery;
  });
  mocks.stageQuery.order.mockResolvedValue({ data: seededStages, error: null });
  mocks.membershipQuery.select.mockReturnValue(mocks.membershipQuery);
  mocks.membershipQuery.eq.mockImplementation((column: string, value: unknown) => {
    (mocks.queryFilters.workspace_members ??= []).push([column, value]);
    return mocks.membershipQuery;
  });
  mocks.membershipQuery.order.mockResolvedValue({
    data: [{ user_id: "user-1", workspace_id: workspaceContext.workspaceId, role: "admin", status: "active" }],
    error: null,
  });
  mocks.workspaceQuery.select.mockReturnValue(mocks.workspaceQuery);
  mocks.workspaceQuery.in.mockImplementation(async (column: string, values: unknown) => {
    (mocks.queryFilters.workspaces ??= []).push([column, values]);
    return { data: [{ id: workspaceContext.workspaceId, name: "Acme" }], error: null };
  });
  mocks.profileQuery.select.mockReturnValue(mocks.profileQuery);
  mocks.profileQuery.eq.mockImplementation((column: string, value: unknown) => {
    (mocks.queryFilters.profiles ??= []).push([column, value]);
    return mocks.profileQuery;
  });
  mocks.profileQuery.maybeSingle.mockResolvedValue({
    data: { full_name: "Avery Chen", date_format: null, avatar_url: null },
    error: null,
  });
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === "pipelines") return mocks.pipelineQuery;
    if (table === "pipeline_stages") return mocks.stageQuery;
    if (table === "workspace_members") return mocks.membershipQuery;
    if (table === "workspaces") return mocks.workspaceQuery;
    if (table === "profiles") return mocks.profileQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("onboarding handoff", () => {
  it("routes a successfully created workspace into the optional setup handoff", async () => {
    const formData = new FormData();
    formData.set("workspaceName", "Acme Sales");
    formData.set("jobTitle", "Sales lead");

    await expect(createWorkspaceAction({ message: "" }, formData)).rejects.toThrow("REDIRECT:/onboarding?setup=workspace-created");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("create_first_workspace", {
      workspace_name: "Acme Sales",
      member_job_title: "Sales lead",
      pipeline_template: "standard_sales",
    });
  });

  it("sends only an allowlisted selected pipeline template to the workspace RPC", async () => {
    const formData = new FormData();
    formData.set("workspaceName", "Simple Team");
    formData.set("jobTitle", "Sales lead");
    formData.set("pipelineTemplate", "simple_sales");

    await expect(createWorkspaceAction({ message: "" }, formData)).rejects.toThrow("REDIRECT:/onboarding?setup=workspace-created");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("create_first_workspace", {
      workspace_name: "Simple Team",
      member_job_title: "Sales lead",
      pipeline_template: "simple_sales",
    });
  });

  it("rejects a forged pipeline template before calling Supabase", async () => {
    const formData = new FormData();
    formData.set("workspaceName", "Acme Sales");
    formData.set("pipelineTemplate", "custom_sql");

    await expect(createWorkspaceAction({ message: "" }, formData)).resolves.toMatchObject({ message: expect.stringContaining("standard_sales") });
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("shows the current workspace pipeline and its persisted stages after creation", async () => {
    render(await OnboardingPage({ searchParams: Promise.resolve({ setup: "workspace-created" }) }));

    expect(screen.getByRole("heading", { name: "Your Standard Sales pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Standard Sales is already set as your workspace’s default pipeline.")).toBeInTheDocument();
    for (const stage of seededStages) expect(screen.getByText(stage.name)).toBeInTheDocument();
    expect(mocks.queryFilters.pipelines).toContainEqual(["workspace_id", "workspace-1"]);
    expect(mocks.queryFilters.pipeline_stages).toContainEqual(["workspace_id", "workspace-1"]);
  });

  it.each([{}, { setup: "other" }, { setup: ["workspace-created"] }])(
    "redirects an existing workspace visitor with invalid or missing handoff state %#",
    async (query) => {
      await expect(OnboardingPage({ searchParams: Promise.resolve(query) })).rejects.toThrow("REDIRECT:/app/dashboard");
    },
  );

  it("labels optional steps 5 and 6 and provides step 7 and direct dashboard paths", async () => {
    render(await OnboardingPage({ searchParams: Promise.resolve({ setup: "workspace-created" }) }));

    expect(screen.getByRole("link", { name: /Step 5: Import a CSV \(optional\)/ })).toHaveAttribute("href", "/app/data-import");
    expect(screen.getByRole("link", { name: /Step 6: Invite teammates \(optional\)/ })).toHaveAttribute("href", "/app/settings/users");
    expect(screen.getByRole("link", { name: "Step 7: Enter dashboard" })).toHaveAttribute("href", "/app/dashboard");
    expect(screen.getByRole("link", { name: "Skip optional setup and go to dashboard" })).toHaveAttribute("href", "/app/dashboard");
    expect(screen.getByText(/Steps 5–6 of 7 · Optional setup/)).toHaveAttribute("aria-current", "step");
  });
});
