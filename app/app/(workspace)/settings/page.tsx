import Link from "next/link";
import { Building2, ListOrdered, Tags, UserRound, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getWorkspaceContext } from "@/lib/auth/context";
import { MyPreferences } from "./my-preferences";

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) throw new Error("Workspace context is unavailable.");

  return (
    <div className="page-container">
      <PageHeader description="Workspace and account configuration." title="Settings" />
      <Link className="access-settings-link" href="/app/settings/profile">
        <span aria-hidden="true" className="access-settings-icon"><UserRound size={19} /></span>
        <span><strong>Profile settings</strong><small>Update your name, avatar, phone, job title, and timezone</small></span>
      </Link>
      <MyPreferences dateFormat={context.dateFormat} />
      {context.role === "admin" ? (
        <>
          <Link className="access-settings-link" href="/app/settings/workspace">
            <span aria-hidden="true" className="access-settings-icon"><Building2 size={19} /></span>
            <span><strong>Workspace settings</strong><small>Update the workspace name, logo, currency, and timezone</small></span>
          </Link>
          <Link className="access-settings-link" href="/app/settings/users">
            <span aria-hidden="true" className="access-settings-icon"><UsersRound size={19} /></span>
            <span><strong>Workspace access</strong><small>Manage members, roles, and invitations</small></span>
          </Link>
          <Link className="access-settings-link" href="/app/settings/tags">
            <span aria-hidden="true" className="access-settings-icon"><Tags size={19} /></span>
            <span><strong>Tags</strong><small>Create, rename, and remove workspace tags</small></span>
          </Link>
          <Link className="access-settings-link" href="/app/settings/pipeline">
            <span aria-hidden="true" className="access-settings-icon"><ListOrdered size={19} /></span>
            <span><strong>Pipeline stages</strong><small>Rename and reorder active stages</small></span>
          </Link>
        </>
      ) : (
        <EmptyState description="CRM data and additional workspace settings are not connected yet." title="No other settings available" />
      )}
    </div>
  );
}
