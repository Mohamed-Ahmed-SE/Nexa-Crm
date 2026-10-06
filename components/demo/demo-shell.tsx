"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Building2, CheckSquare2, LayoutDashboard, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./demo.module.css";

const navigation = [
  { href: "/demo", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/leads", label: "Leads", icon: UsersRound },
  { href: "/demo/contacts", label: "Contacts", icon: UserRound },
  { href: "/demo/companies", label: "Companies", icon: Building2 },
  { href: "/demo/deals", label: "Deals", icon: BriefcaseBusiness },
  { href: "/demo/tasks", label: "Tasks", icon: CheckSquare2 },
  { href: "/demo/reports", label: "Reports", icon: BarChart3 },
];

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dashboardShowsNotice = pathname === "/demo";

  return <div className={styles.frame}>
    <aside className={styles.sidebar}>
      <Link aria-label="Nexa CRM demo dashboard" className={styles.brand} href="/demo">
        <span className={styles.brandMark}>N</span><span>Nexa CRM</span>
      </Link>
      <div className={styles.workspace}><span className={styles.workspaceDot} /> Sample workspace</div>
      <nav aria-label="Demo workspace" className={styles.navigation}>
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/demo" ? pathname === href : pathname.startsWith(href);
          return <Link aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.active : ""}`} href={href} key={href}>
            <Icon aria-hidden="true" size={17} />{label}
          </Link>;
        })}
      </nav>
      <p className={styles.sidebarFoot}>Read-only preview · No account required</p>
    </aside>
    <main className={styles.main}>
      {!dashboardShowsNotice && <aside aria-label="Sample data notice" className={styles.notice}>
        <span className={styles.noticeDot} />
        <p><strong>Fictional sample workspace</strong><span>All records are fictional. Changes are not saved.</span></p>
      </aside>}
      {children}
    </main>
  </div>;
}
