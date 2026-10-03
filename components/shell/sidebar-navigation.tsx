import Link from "next/link";
import {
  primaryNavigation,
  secondaryNavigation,
  utilityNavigation,
  type NavigationLink,
} from "@/lib/navigation";

type SidebarNavigationProps = {
  activePath: string;
  onNavigate?: () => void;
};

function isActiveLink(activePath: string, href: string) {
  return activePath === href || activePath.startsWith(`${href}/`);
}

function NavigationSection({
  title,
  links,
  activePath,
  onNavigate,
}: {
  title?: string;
  links: NavigationLink[];
  activePath: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="nav-section">
      {title ? <h2 className="nav-section-title">{title}</h2> : null}
      <ul className="nav-list">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = isActiveLink(activePath, href);
          return (
            <li key={href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`nav-link${isActive ? " nav-link-active" : ""}`}
                href={href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" className="nav-icon" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SidebarNavigation({ activePath, onNavigate }: SidebarNavigationProps) {
  return (
    <nav aria-label="Main navigation" className="sidebar-navigation">
      <NavigationSection
        activePath={activePath}
        links={primaryNavigation}
        onNavigate={onNavigate}
      />
      <NavigationSection
        activePath={activePath}
        links={secondaryNavigation}
        onNavigate={onNavigate}
        title="Insights"
      />
      <NavigationSection
        activePath={activePath}
        links={utilityNavigation}
        onNavigate={onNavigate}
        title="Workspace"
      />
    </nav>
  );
}
