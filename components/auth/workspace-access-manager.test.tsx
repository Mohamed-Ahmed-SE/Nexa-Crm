import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceAccessManager, type WorkspaceInviteRow, type WorkspaceMemberRow } from "@/components/auth/workspace-access-manager";

vi.mock("@/lib/auth/invite-actions", () => ({
  acceptWorkspaceInviteAction: vi.fn(),
  createWorkspaceInviteAction: vi.fn(),
  revokeWorkspaceInviteAction: vi.fn(),
  signOutForInviteAction: vi.fn(),
}));
vi.mock("@/lib/auth/member-actions", () => ({
  updateWorkspaceMember: vi.fn(),
}));

const invite: WorkspaceInviteRow = {
  invite_id: "invite-1",
  email: "teammate@example.com",
  role: "member",
  expires_at: "2026-04-10T00:00:00.000Z",
  accepted_at: "2026-04-03T12:00:00.000Z",
  revoked_at: null,
  created_at: "2026-04-03T09:30:00.000Z",
  expired: false,
};

const deactivatedMember: WorkspaceMemberRow = {
  member_id: "member-1",
  user_id: "user-2",
  email: "former-teammate@example.com",
  full_name: "Former Teammate",
  role: "member",
  status: "deactivated",
  joined_at: "2026-04-01T00:00:00.000Z",
};

describe("WorkspaceAccessManager", () => {
  it("keeps deactivated members visible with an Inactive user marker", () => {
    render(<WorkspaceAccessManager currentUserId="user-1" invites={[]} members={[deactivatedMember]} />);

    const members = screen.getByRole("region", { name: "Workspace members" });
    const row = within(within(members).getByRole("table")).getByRole("row", { name: /Former Teammate/ });

    expect(row).toBeVisible();
    expect(within(row).getByText("Inactive user", { exact: true })).toBeVisible();
  });

  it("shows when an invitation was created", () => {
    render(<WorkspaceAccessManager currentUserId="user-1" invites={[invite]} members={[]} />);

    const invitations = screen.getByRole("region", { name: "Invitations" });
    const table = within(invitations).getByRole("table");

    expect(within(table).getByRole("columnheader", { name: "Invited" })).toBeInTheDocument();
    expect(within(table).getByText("04/03/2026")).toBeInTheDocument();
    expect(within(table).getByText("04/03/2026").closest("time")).toHaveAttribute("dateTime", invite.created_at);
  });
});
