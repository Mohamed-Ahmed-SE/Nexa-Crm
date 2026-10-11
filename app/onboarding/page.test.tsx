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
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      rpc: vi.fn(),
      from: vi.fn(),
    },
    queryFilters: {} as Record<string, Array<[string, unknown]>>,
    pipelineQuery,
    stageQuery,
    isSupabaseConfigured: vi.fn(),
    createSupabaseServerClient: vi.fn(),
    redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: mocks.isSupabaseConfigured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

const workspaceContext = { workspaceId: "workspace-1" };
const defaultPipeline = { id: "pipeline-1", name: "Sales" };
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
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === "pipelines") return mocks.pipelineQuery;
    if (table === "pipeline_stages") return mocks.stageQuery;
    const tableData = {
      workspace_members: { user_id: "user-1", workspace_id: workspaceContext.workspaceId, role: "admin", status: "active" },
      workspaces: { id: workspaceContext.workspaceId, name: "Acme" },
      profiles: { full_name: "Avery Chen", date_format: null, avatar_url: null },
    }[table as "workspace_members" | "workspaces" | "profiles"];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        (mocks.queryFilters[table] ??= []).push([column, value]);
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: tableData, error: null })),
    };
    return query;
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
    });
  });

  it("shows the current workspace pipeline and its persisted stages after creation", async () => {
    render(await OnboardingPage({ searchParams: Promise.resolve({ setup: "workspace-created" }) }));

    expect(screen.getByRole("heading", { name: "Standard sales pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Sales is already set as your workspace’s default pipeline.")).toBeInTheDocument();
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

  it("provides both optional routes and accessible skip and continue paths", async () => {
    render(await OnboardingPage({ searchParams: Promise.resolve({ setup: "workspace-created" }) }));

    expect(screen.getByRole("link", { name: /import a csv/i })).toHaveAttribute("href", "/app/data-import");
    expect(screen.getByRole("link", { name: /invite teammates/i })).toHaveAttribute("href", "/app/settings/users");
    expect(screen.getByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/app/dashboard");
    expect(screen.getByRole("link", { name: "Skip remaining setup" })).toHaveAttribute("href", "/app/dashboard");
    expect(screen.getByText("Optional setup")).toHaveAttribute("aria-current", "step");
  });
});
