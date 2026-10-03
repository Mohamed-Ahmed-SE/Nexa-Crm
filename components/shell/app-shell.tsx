"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { SidebarNavigation } from "@/components/shell/sidebar-navigation";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const NavigationToggleIcon = isMobileNavigationOpen ? X : Menu;

  return (
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
          <div aria-label="Search" className="global-search" role="search">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label="Search CRM"
              disabled
              placeholder="Search will be available when CRM data is connected"
              type="search"
            />
            <span aria-hidden="true" className="search-shortcut">⌘ K</span>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Notifications are not connected"
              className="icon-button"
              disabled
              title="Notifications are not connected"
              type="button"
            >
              <Bell aria-hidden="true" size={18} />
            </button>
            <div aria-label="Nexa CRM workspace" className="workspace-identity">
              <span aria-hidden="true" className="user-avatar">N</span>
              <span className="workspace-copy">
                <span className="workspace-name">Your workspace</span>
                <span className="workspace-caption">Not configured</span>
              </span>
            </div>
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
  );
}
