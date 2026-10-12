import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { SetupNotice } from "@/components/auth/setup-notice";
import { getWorkspaceContext } from "@/lib/auth/context";
import { throwIfAuthVerificationFailed } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

const POST_CREATE_HANDOFF = "workspace-created";
const DASHBOARD_PATH = "/app/dashboard";

type OnboardingPageProps = {
  searchParams: Promise<{ setup?: string | string[] }>;
};

type Pipeline = { id: string; name: string };
type PipelineStage = { name: string; position: number };

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type WorkspacePipeline = { pipeline: Pipeline | null; stages: PipelineStage[] };

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const supabase = await createSupabaseServerClient();
  const { data: authResult, error } = await supabase!.auth.getUser();
  throwIfAuthVerificationFailed(error);
  if (!authResult.user) redirect("/auth/sign-in?next=/onboarding");

  const params = await searchParams;
  const context = await getWorkspaceContext();
  if (context && params.setup !== POST_CREATE_HANDOFF) redirect(DASHBOARD_PATH);
  if (!context || params.setup !== POST_CREATE_HANDOFF) return <WorkspaceCreation />;

  const workspacePipeline = await getWorkspacePipeline(supabase!, context.workspaceId);
  return <SetupHandoff {...workspacePipeline} />;
}

async function getWorkspacePipeline(supabase: SupabaseClient, workspaceId: string): Promise<WorkspacePipeline> {
  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,name")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .maybeSingle();
  if (pipelineError) throw new Error("Workspace pipeline could not be loaded.");
  if (!pipeline) return { pipeline: null, stages: [] };

  const { data: stages, error: stagesError } = await supabase
    .from("pipeline_stages")
    .select("name,position")
    .eq("workspace_id", workspaceId)
    .eq("pipeline_id", pipeline.id)
    .eq("is_active", true)
    .order("position");
  if (stagesError) throw new Error("Workspace pipeline stages could not be loaded.");
  return { pipeline: pipeline as Pipeline, stages: (stages ?? []) as PipelineStage[] };
}

function WorkspaceCreation() {
  return (
    <AuthCard description="Set up the shared space for your team. You can configure the rest later." title="Create your workspace">
      <OnboardingForm />
    </AuthCard>
  );
}

function SetupHandoff({ pipeline, stages }: WorkspacePipeline) {
  return (
    <AuthCard description="Your workspace is ready. Take an optional next step, or head straight to your dashboard." title="Let’s get you set up">
      <HandoffProgress />
      <PipelineSummary pipeline={pipeline} stages={stages} />
      <OptionalSetupLinks />
      <DashboardActions />
    </AuthCard>
  );
}

function HandoffProgress() {
  return (
    <div aria-label="Onboarding progress" className={styles.handoffProgress} role="list">
      <span role="listitem">Workspace created</span>
      <span aria-hidden="true" className={styles.handoffDivider} />
      <span aria-current="step" className={styles.handoffCurrent} role="listitem">Steps 5–6 of 7 · Optional setup</span>
      <span aria-hidden="true" className={styles.handoffDivider} />
      <span role="listitem">Step 7 · Dashboard</span>
    </div>
  );
}

function PipelineSummary({ pipeline, stages }: WorkspacePipeline) {
  return (
    <section aria-labelledby="pipeline-title" className={styles.pipelineSummary}>
      <h2 id="pipeline-title">{pipeline ? `Your ${pipeline.name} pipeline` : "Your sales pipeline"}</h2>
      {pipeline ? (
        <>
          <p>{pipeline.name} is already set as your workspace’s default pipeline.</p>
          <ol className={styles.stageList}>
            {stages.map((stage) => <li key={`${stage.position}-${stage.name}`}>{stage.name}</li>)}
          </ol>
        </>
      ) : <p>No default pipeline is currently available in this workspace.</p>}
    </section>
  );
}

function OptionalSetupLinks() {
  return (
    <nav aria-label="Optional setup steps" className={styles.nextSteps}>
      <Link className={styles.nextStep} href="/app/data-import">
        <strong>Step 5: Import a CSV (optional)</strong>
        <span>Bring leads, contacts, or companies into your workspace.</span>
      </Link>
      <Link className={styles.nextStep} href="/app/settings/users">
        <strong>Step 6: Invite teammates (optional)</strong>
        <span>Manage workspace members and send invitations.</span>
      </Link>
    </nav>
  );
}

function DashboardActions() {
  return (
    <div className={styles.dashboardActions}>
      <Link className={styles.continueLink} href={DASHBOARD_PATH}>Step 7: Enter dashboard</Link>
      <Link className={styles.skipLink} href={DASHBOARD_PATH}>Skip optional setup and go to dashboard</Link>
    </div>
  );
}
