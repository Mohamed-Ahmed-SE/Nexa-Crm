"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  acceptWorkspaceInviteAction,
  createWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  signOutForInviteAction,
} from "@/lib/auth/invite-actions";
import type { InviteActionState, MemberActionState } from "@/lib/auth/member-actions";
import { updateWorkspaceMember } from "@/lib/auth/member-actions";
import { workspaceRoles, type WorkspaceRole } from "@/lib/auth/permissions";

export type WorkspaceMemberRow = {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: WorkspaceRole;
  status: "active" | "deactivated";
  joined_at: string;
};

export type WorkspaceInviteRow = {
  invite_id: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  expired: boolean;
};

const initialMemberState: MemberActionState = { message: "" };
const initialInviteState: InviteActionState = { message: "" };

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
}

function inviteStatus(invite: WorkspaceInviteRow): string {
  if (invite.accepted_at) return "Accepted";
  if (invite.revoked_at) return "Revoked";
  if (invite.expired) return "Expired";
  return "Pending";
}

function ActionMessage({ state }: { state: MemberActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "access-message access-message-success" : "access-message"} role={state.ok ? "status" : "alert"}>{state.message}</p>;
}

function MemberChangeForm({
  member,
  change,
}: {
  member: WorkspaceMemberRow;
  change: "role" | "status";
}) {
  const [state, action, pending] = useActionState(updateWorkspaceMember, initialMemberState);
  return (
    <form action={action} className="access-inline-form">
      <input name="memberId" type="hidden" value={member.member_id} />
      {change === "role" ? (
        <>
          <label className="sr-only" htmlFor={`role-${member.member_id}`}>Role for {member.full_name}</label>
          <select defaultValue={member.role} disabled={pending} id={`role-${member.member_id}`} name="role">
            {workspaceRoles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button className="access-quiet-button" disabled={pending} type="submit">{pending ? "Saving…" : "Update"}</button>
        </>
      ) : (
        <>
          <input name="status" type="hidden" value={member.status === "active" ? "deactivated" : "active"} />
          <button className="access-quiet-button" disabled={pending} type="submit">
            {pending ? "Saving…" : member.status === "active" ? "Deactivate" : "Reactivate"}
          </button>
        </>
      )}
      <ActionMessage state={state} />
    </form>
  );
}

function InviteRevokeForm({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(revokeWorkspaceInviteAction, initialMemberState);
  return (
    <form action={action} className="access-inline-form">
      <input name="inviteId" type="hidden" value={inviteId} />
      <button className="access-quiet-button" disabled={pending} type="submit">{pending ? "Revoking…" : "Revoke"}</button>
      <ActionMessage state={state} />
    </form>
  );
}

function InviteCreationForm() {
  const [state, action, pending] = useActionState(createWorkspaceInviteAction, initialInviteState);
  const [copyState, setCopyState] = useState("");

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("Link copied.");
    } catch {
      setCopyState("Copy was blocked. Select and copy the link above.");
    }
  }

  return (
    <>
      <form action={action} className="access-invite-form">
        <label className="auth-field">
          <span>Email address</span>
          <input autoComplete="email" maxLength={254} name="email" placeholder="teammate@company.com" required type="email" />
        </label>
        <label className="auth-field">
          <span>Workspace role</span>
          <select defaultValue="member" name="role">
            {workspaceRoles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button className="auth-submit access-submit" disabled={pending} type="submit">{pending ? "Creating link…" : "Create invitation"}</button>
      </form>
      {state.message ? <p className={state.ok ? "access-message access-message-success" : "access-message"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      {state.inviteLink ? (
        <div className="access-share-link">
          <label className="auth-field" htmlFor="invite-link"><span>One-time invitation link</span><input id="invite-link" readOnly type="url" value={state.inviteLink} /></label>
          <button aria-label="Copy invitation link" className="access-quiet-button" onClick={() => void copyInviteLink(state.inviteLink ?? "")} type="button">
            {copyState === "Link copied." ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
            {copyState === "Link copied." ? "Copied" : "Copy link"}
          </button>
          {copyState ? <span aria-live="polite" className="access-copy-state">{copyState}</span> : null}
        </div>
      ) : null}
    </>
  );
}

function InvitationAcceptanceForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptWorkspaceInviteAction, initialMemberState);
  return (
    <form action={action} className="auth-form">
      <input name="token" type="hidden" value={token} />
      <p className="auth-hint">You must sign in with the invited email address. Invitation links expire and can only be accepted once.</p>
      <button className="auth-submit" disabled={pending} type="submit">{pending ? "Accepting…" : "Accept invitation"}</button>
      <ActionMessage state={state} />
    </form>
  );
}

export function WorkspaceAccessManager({
  members,
  invites,
  currentUserId,
}: {
  members: WorkspaceMemberRow[];
  invites: WorkspaceInviteRow[];
  currentUserId: string;
}) {
  return (
    <div className="workspace-access">
      <section aria-labelledby="invite-title" className="access-panel">
        <div className="access-panel-heading">
          <div><h2 id="invite-title">Invite a teammate</h2><p>Create a secure link to share directly with the invited person.</p></div>
        </div>
        <InviteCreationForm />
      </section>

      <section aria-labelledby="members-title" className="access-panel">
        <div className="access-panel-heading">
          <div><h2 id="members-title">Workspace members</h2><p>{members.length} {members.length === 1 ? "member" : "members"}</p></div>
        </div>
        {members.length ? (
          <div className="deal-table-scroll">
            <table className="deal-table access-table">
              <thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Access</th></tr></thead>
              <tbody>{members.map((member) => (
                <tr key={member.member_id}>
                  <td><strong>{member.full_name || member.email}</strong><span className="access-secondary">{member.email}</span></td>
                  <td>{member.role}</td>
                  <td><span className={`access-status access-status-${member.status}`}>{member.status}</span></td>
                  <td><time dateTime={member.joined_at}>{formatDate(member.joined_at)}</time></td>
                  <td>{member.user_id === currentUserId ? <span className="access-secondary">You</span> : (
                    <div className="access-controls">
                      <MemberChangeForm change="role" member={member} />
                      <MemberChangeForm change="status" member={member} />
                    </div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="access-empty">No workspace members yet.</p>}
      </section>

      <section aria-labelledby="invitations-title" className="access-panel">
        <div className="access-panel-heading">
          <div><h2 id="invitations-title">Invitations</h2><p>Links are never emailed or saved for later display.</p></div>
        </div>
        {invites.length ? (
          <div className="deal-table-scroll">
            <table className="deal-table access-table">
              <thead><tr><th scope="col">Invited email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Expires</th><th scope="col">Action</th></tr></thead>
              <tbody>{invites.map((invite) => {
                const status = inviteStatus(invite);
                return (
                  <tr key={invite.invite_id}>
                    <td>{invite.email}</td><td>{invite.role}</td>
                    <td><span className={`access-status access-status-${status.toLowerCase()}`}>{status}</span></td>
                    <td><time dateTime={invite.expires_at}>{formatDate(invite.expires_at)}</time></td>
                    <td>{status === "Pending" || status === "Expired" ? <InviteRevokeForm inviteId={invite.invite_id} /> : <span className="access-secondary">—</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="access-empty">No invitations yet. New invitations appear here after you create a link.</p>}
      </section>
    </div>
  );
}

export function AcceptWorkspaceInvite({ token, signedInEmail }: { token: string; signedInEmail?: string }) {
  const acceptUrl = `/auth/accept-invite?token=${encodeURIComponent(token)}`;
  return (
    <div className="auth-form">
      {signedInEmail ? <p className="auth-hint">You are signed in as <strong>{signedInEmail}</strong>. If that is not the invited address, sign out and use the invited account.</p> : null}
      <InvitationAcceptanceForm token={token} />
      {signedInEmail ? (
        <form action={signOutForInviteAction} className="invite-sign-out-form">
          <input name="next" type="hidden" value={acceptUrl} />
          <button className="auth-secondary-link invite-sign-out-button" type="submit">Sign out to use another account</button>
        </form>
      ) : null}
    </div>
  );
}
