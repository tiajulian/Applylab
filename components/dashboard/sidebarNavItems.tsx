import type { ComponentType, SVGProps } from "react";
import {
  HouseIcon,
  BriefcaseIcon,
  TargetIcon,
  FileTextIcon,
  MicIcon,
  UserIcon,
  PuzzleIcon,
} from "@/components/ui/icons/LucideIcons";

export interface SidebarNavItem {
  label: string;
  /** Shorter label for the phone tab bar, where five items share 390px. */
  shortLabel?: string;
  /** One plain line under the label saying what the page is for. */
  hint: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Other route prefixes that belong to this item (e.g. the editor belongs to "Resumes"). */
  matches?: string[];
  /** Position in the job-hunt order (1-4). Shown as a step number so the order is obvious. */
  step?: number;
  dataTour?: string;
  proOnly?: boolean;
}

export const HOME_NAV_ITEM: SidebarNavItem = {
  label: "Home",
  hint: "What to do next",
  href: "/dashboard",
  icon: HouseIcon,
};

/** The four steps of a job hunt, in the order people do them. */
export const STEP_NAV_ITEMS: SidebarNavItem[] = [
  {
    label: "My profile",
    shortLabel: "Profile",
    hint: "Your experience, added once",
    href: "/profile",
    icon: UserIcon,
    step: 1,
    dataTour: "nav-profile",
  },
  {
    label: "Resumes & letters",
    shortLabel: "Resumes",
    hint: "Made for each job ad",
    href: "/documents",
    icon: FileTextIcon,
    matches: ["/resume", "/cover-letter"],
    step: 2,
    dataTour: "nav-documents",
  },
  {
    label: "Applications",
    shortLabel: "Applied",
    hint: "Jobs you've applied for",
    href: "/applications",
    icon: BriefcaseIcon,
    step: 3,
    dataTour: "nav-applications",
  },
  {
    label: "Interview practice",
    shortLabel: "Interview",
    hint: "Practise your answers",
    href: "/interview",
    icon: MicIcon,
    step: 4,
    dataTour: "nav-interview",
    proOnly: true,
  },
];

/** Helpful extras that aren't part of the core four steps. */
export const MORE_NAV_ITEMS: SidebarNavItem[] = [
  {
    label: "Find jobs",
    hint: "Job ads that fit your profile",
    href: "/job-matcher",
    icon: TargetIcon,
  },
  {
    label: "Chrome extension",
    hint: "Fill in job forms faster",
    href: "/extension",
    icon: PuzzleIcon,
    dataTour: "nav-extension",
  },
];


export function isNavItemActive(item: SidebarNavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return [item.href, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
