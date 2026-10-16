import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { FileTextIcon, FilePenLineIcon, BriefcaseIcon, MicIcon } from "@/components/ui/icons/LucideIcons";

interface QuickAction {
  label: string;
  hint: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Shortcuts straight into each tool (the launcher row Huntr and Rezi open their home with). */
export function QuickActions({
  isFreePlan,
  tailor,
}: {
  isFreePlan: boolean;
  /** Where "Tailor a resume" goes: the upgrade page once the free resume is used. */
  tailor: { href: string; hint: string };
}) {
  const actions: QuickAction[] = [
    { label: "Tailor a resume", hint: tailor.hint, href: tailor.href, icon: FileTextIcon },
    { label: "Write a cover letter", hint: "For any job ad", href: "/documents?view=cover-letters&new=1", icon: FilePenLineIcon },
    { label: "Add an application", hint: "Track where you applied", href: "/applications?add=1", icon: BriefcaseIcon },
    {
      label: "Practise an interview",
      hint: isFreePlan ? "Part of Pro" : "Get feedback on answers",
      href: isFreePlan ? "/upgrade" : "/interview",
      icon: MicIcon,
    },
  ];

  return (
    <nav aria-label="Shortcuts">
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {actions.map(({ label, hint, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex h-full items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[13.5px] font-semibold leading-tight text-ink">{label}</span>
                <span className="text-[12px] leading-snug text-ink-muted">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
