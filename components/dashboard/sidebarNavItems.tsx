import type { ComponentType, SVGProps } from "react";
import {
  LayoutDashboardIcon,
  BriefcaseIcon,
  TargetIcon,
  FileTextIcon,
  MicIcon,
  MessageSquareIcon,
  PuzzleIcon,
} from "@/components/ui/icons/LucideIcons";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  dataTour?: string;
  disabled?: boolean;
}

// Job Matcher and Cover Letter have no dedicated page yet - shown disabled ("Soon") until built.
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Applications", href: "/applications", icon: BriefcaseIcon, dataTour: "nav-applications" },
  { label: "Job Matcher", href: "/job-matcher", icon: TargetIcon, disabled: true },
  { label: "Resume Builder", href: "/resume/new", icon: FileTextIcon },
  { label: "Interview Coach", href: "/interview", icon: MicIcon, dataTour: "nav-interview" },
  { label: "Cover Letter", href: "/cover-letter", icon: MessageSquareIcon, disabled: true },
  { label: "Autofill", href: "/extension", icon: PuzzleIcon },
];
