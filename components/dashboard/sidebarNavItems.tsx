import type { ComponentType, SVGProps } from "react";
import {
  HouseIcon,
  BriefcaseIcon,
  TargetIcon,
  FileTextIcon,
  MicIcon,
  FilePenLineIcon,
  WandSparklesIcon,
} from "@/components/ui/icons/LucideIcons";
import { COVER_LETTER_V1_ENABLED } from "@/lib/coverLetter/config";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  dataTour?: string;
  disabled?: boolean;
}

// Job Matcher has no dedicated page yet - shown disabled ("Soon") until built. Cover Letter stays "Soon"
// until the cover_letter_v1 flag is on.
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Home", href: "/dashboard", icon: HouseIcon },
  { label: "Applications", href: "/applications", icon: BriefcaseIcon, dataTour: "nav-applications" },
  { label: "Job Matcher", href: "/job-matcher", icon: TargetIcon, disabled: true },
  { label: "Resume Builder", href: "/resume/new", icon: FileTextIcon },
  { label: "Interview Coach", href: "/interview", icon: MicIcon, dataTour: "nav-interview" },
  { label: "Cover Letter", href: "/cover-letter", icon: FilePenLineIcon, disabled: !COVER_LETTER_V1_ENABLED },
  { label: "Autofill", href: "/extension", icon: WandSparklesIcon },
];
