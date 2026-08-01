"use client";

import Link from "next/link";
import { TEMPLATE_LIST } from "@/lib/resume/templateRegistry";
import { Badge } from "@/components/ui/Badge";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { Template } from "@/types";

export function TemplatePicker({
  selected,
  isPaidPlan,
  onSelect,
}: {
  selected: Template;
  isPaidPlan: boolean;
  onSelect: (template: Template) => void;
}) {
  return (
    <StaggerList className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {TEMPLATE_LIST.map((template) => {
        const isSelected = template.id === selected;
        const isLocked = template.proOnly && !isPaidPlan;
        // A resume can end up with a proOnly template selected while the account is on the
        // free plan (e.g. selected while Pro, then the subscription lapsed) — that's a
        // distinct state from "locked and never selected": still show it as selected, but
        // make clear it's no longer usable rather than presenting a plain "Selected" control.
        const isSelectedButLocked = isSelected && isLocked;

        return (
          <StaggerItem key={template.id}>
            <div
              className={
                isSelected
                  ? "flex h-full flex-col gap-2 rounded border-2 border-accent bg-accent-soft p-4 transition-colors duration-fast ease-editorial"
                  : isLocked
                    ? "flex h-full flex-col gap-2 rounded border border-border bg-paper-deep p-4 opacity-75 transition-colors duration-fast ease-editorial"
                    : "flex h-full flex-col gap-2 rounded border border-border bg-surface p-4 transition-colors duration-fast ease-editorial"
              }
            >
              <div className={`h-1.5 w-10 rounded-pill ${template.accentClassName}`} />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{template.name}</span>
                {template.proOnly && (
                  <Badge variant="neutral" className="text-[10px] uppercase tracking-wide">
                    Pro
                  </Badge>
                )}
              </div>
              <p className="text-xs text-ink-muted">{template.description}</p>

              {isSelectedButLocked ? (
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-xs font-medium text-attention">
                    Currently selected, but your plan no longer covers this template
                  </span>
                  <Link
                    href="/upgrade"
                    className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Upgrade to keep using it →
                  </Link>
                </div>
              ) : isLocked ? (
                <Link
                  href="/upgrade"
                  className="mt-1 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Upgrade to unlock →
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={isSelected}
                  onClick={() => onSelect(template.id)}
                  className="mt-1 self-start text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-ink-muted disabled:no-underline"
                >
                  {isSelected ? "Selected" : "Use this template"}
                </button>
              )}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
