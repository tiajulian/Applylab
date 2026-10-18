import type { ComponentType, SVGProps } from "react";

export interface SidebarNavItem {
  label: string;
  /** Shorter label for the phone tab bar, where five items share 390px. */
  shortLabel?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Other route prefixes that belong to this item (e.g. the editor belongs to "Resumes"). */
  matches?: string[];
  dataTour?: string;
  proOnly?: boolean;
}

// Outline icons from the dashboard reference design (24px grid, 1.8 stroke). Colour comes from
// currentColor so the sidebar and tab bar can tint them for the active page.
function navIcon(d: string) {
  function NavIcon({ strokeWidth = 1.8, ...props }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d={d} />
      </svg>
    );
  }
  return NavIcon;
}

const HomeNavIcon = navIcon("M4 11l8-7 8 7v9h-5v-6H9v6H4z");
const ProfileNavIcon = navIcon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6");
const ResumesNavIcon = navIcon("M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5");
const ApplicationsNavIcon = navIcon("M4 8h16v12H4zM9 8V5h6v3M4 13h16");
const InterviewNavIcon = navIcon("M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3");
const FindJobsNavIcon = navIcon("M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4");
const ExtensionNavIcon = navIcon("M9 4h6v4h4v6h-4v6H9v-6H5V8h4z");

export const PROFILE_HREF = "/profile";

/** The main pages, in the order people use them. Also the phone tab bar. */
export const MAIN_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Home", href: "/dashboard", icon: HomeNavIcon },
  { label: "Profile", href: PROFILE_HREF, icon: ProfileNavIcon, dataTour: "nav-profile" },
  {
    label: "Resumes",
    href: "/documents",
    icon: ResumesNavIcon,
    matches: ["/resume", "/cover-letter"],
    dataTour: "nav-documents",
  },
  {
    label: "Applications",
    shortLabel: "Applied",
    href: "/applications",
    icon: ApplicationsNavIcon,
    dataTour: "nav-applications",
  },
  {
    label: "Interview practice",
    shortLabel: "Interview",
    href: "/interview",
    icon: InterviewNavIcon,
    dataTour: "nav-interview",
    proOnly: true,
  },
];

/** Listed under the divider in the sidebar, and in the phone header menu. */
export const MORE_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Find jobs", href: "/job-matcher", icon: FindJobsNavIcon, dataTour: "nav-find-jobs" },
  { label: "Chrome extension", href: "/extension", icon: ExtensionNavIcon, dataTour: "nav-extension" },
];

export function isNavItemActive(item: SidebarNavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return [item.href, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
