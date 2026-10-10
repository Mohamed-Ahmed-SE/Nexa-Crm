"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { GlobalSearch } from "@/components/shell/global-search";
import { SidebarNavigation } from "@/components/shell/sidebar-navigation";
import { hasWorkspacePermission } from "@/lib/auth/permissions";
import { signOutAction } from "@/lib/auth/actions";
import { DateFormatProvider } from "@/components/auth/date-format-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import type { WorkspaceContext } from "@/lib/auth/context";

type AppShellProps = {
  children: React.ReactNode;
  context: WorkspaceContext;
};

export function AppShell({ children, context }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const NavigationToggleIcon = isMobileNavigationOpen ? X : Menu;

  return (
    <DateFormatProvider dateFormat={context.dateFormat}>
      <div className="app-frame">
      <aside
        aria-label="Nexa CRM workspace"
        className={`sidebar${isMobileNavigationOpen ? " sidebar-open" : ""}`}
      >
        <Link aria-label="Nexa CRM home" className="brand" href="/app/dashboard">
          <span aria-hidden="true" className="brand-mark">N</span>
          <span className="brand-name">Nexa CRM</span>
        </Link>
        <SidebarNavigation
          activePath={pathname}
          onNavigate={() => setIsMobileNavigationOpen(false)}
        />
        <div className="sidebar-footnote">
          <span className="status-dot" />
          <span>Foundation build</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            aria-expanded={isMobileNavigationOpen}
            aria-label={isMobileNavigationOpen ? "Close navigation" : "Open navigation"}
            className="icon-button mobile-menu-button"
            onClick={() => setIsMobileNavigationOpen(!isMobileNavigationOpen)}
            type="button"
          >
            <NavigationToggleIcon aria-hidden="true" size={19} />
          </button>
          <GlobalSearch canCreate={hasWorkspacePermission(context.role, "crm.create")} />
          <div className="topbar-actions">
            <Link aria-label="Notifications" className="icon-button" href="/app/notifications" title="Notifications">
              <Bell aria-hidden="true" size={18} />
            </Link>
            <div aria-label="Nexa CRM workspace" className="workspace-identity">
              <UserAvatar key={context.avatarUrl ?? "no-avatar"} avatarUrl={context.avatarUrl} fullName={context.fullName} />
              <span className="workspace-copy">
                <span className="workspace-name">{context.workspaceName}</span>
                <span className="workspace-caption">{context.fullName} · {context.role}</span>
              </span>
            </div>
            <form action={signOutAction}>
              <button className="sign-out-button" type="submit">Sign out</button>
            </form>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
      {isMobileNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="navigation-backdrop"
          onClick={() => setIsMobileNavigationOpen(false)}
          type="button"
        />
      ) : null}
      </div>
    </DateFormatProvider>
  );
}
