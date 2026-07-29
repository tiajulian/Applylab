"use client";

import Link from "next/link";
import { TEMPLATE_LIST } from "@/lib/resume/templateRegistry";
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
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {TEMPLATE_LIST.map((template) => {
        const isSelected = template.id === selected;
        const isLocked = template.proOnly && !isPaidPlan;
        // A resume can end up with a proOnly template selected while the account is on the
        // free plan (e.g. selected while Pro, then the subscription lapsed) — that's a
        // distinct state from "locked and never selected": still show it as selected, but
        // make clear it's no longer usable rather than presenting a plain "Selected" control.
        const isSelectedButLocked = isSelected && isLocked;

        return (
          <div
            key={template.id}
            className={
              isSelected
                ? "flex flex-col gap-2 rounded-xl border-2 border-brand-600 bg-brand-50 p-4"
                : isLocked
                  ? "flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-75"
                  : "flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4"
            }
          >
            <div className={`h-1.5 w-10 rounded-full ${template.accentClassName}`} />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{template.name}</span>
              {template.proOnly && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                  Pro
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{template.description}</p>

            {isSelectedButLocked ? (
              <div className="mt-1 flex flex-col gap-1">
                <span className="text-xs font-medium text-amber-700">
                  Currently selected — your plan no longer covers this template
                </span>
                <Link href="/upgrade" className="text-xs font-medium text-brand-600 hover:underline">
                  Upgrade to keep using it →
                </Link>
              </div>
            ) : isLocked ? (
              <Link href="/upgrade" className="mt-1 text-xs font-medium text-brand-600 hover:underline">
                Upgrade to unlock →
              </Link>
            ) : (
              <button
                type="button"
                disabled={isSelected}
                onClick={() => onSelect(template.id)}
                className="mt-1 self-start text-xs font-medium text-brand-600 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
              >
                {isSelected ? "Selected" : "Use this template"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
