import {
  BarChart3,
  Bell,
  Building2,
  ChartNoAxesCombined,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const primaryNavigation: NavigationLink[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/leads", label: "Leads", icon: ChartNoAxesCombined },
  { href: "/app/contacts", label: "Contacts", icon: UsersRound },
  { href: "/app/companies", label: "Companies", icon: Building2 },
  { href: "/app/deals", label: "Deals", icon: Handshake },
  { href: "/app/tasks", label: "Tasks", icon: ListTodo },
];

export const secondaryNavigation: NavigationLink[] = [
  { href: "/app/reports", label: "Reports", icon: BarChart3 },
];

export const utilityNavigation: NavigationLink[] = [
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];
