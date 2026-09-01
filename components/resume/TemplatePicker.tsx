"use client";

import { CANONICAL_TEMPLATE_LIST, canonicalTemplate } from "@/lib/resume/templateMetadata";
import { Badge } from "@/components/ui/Badge";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { CanonicalTemplate, Template } from "@/types";

export function TemplatePicker({
  selected,
  onSelect,
}: {
  selected: Template;
  isPaidPlan?: boolean;
  onSelect: (template: CanonicalTemplate) => void;
}) {
  const canonicalSelected = canonicalTemplate(selected);

  return (
    <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CANONICAL_TEMPLATE_LIST.map((template) => {
        const isSelected = template.id === canonicalSelected;

        return (
          <StaggerItem key={template.id}>
            <div
              className={`flex h-full flex-col justify-between gap-3 rounded-lg border p-4 transition-all duration-fast ease-editorial ${
                isSelected
                  ? "border-accent bg-accent-soft/40 shadow-sm ring-1 ring-accent"
                  : "border-border bg-surface hover:border-ink-muted/40 hover:bg-paper-deep/40"
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${template.accentClassName}`} />
                    <span className="text-sm font-semibold text-ink">{template.name}</span>
                  </div>
                  {template.isRecommended && (
                    <Badge variant="accent" className="text-[10px] font-bold uppercase tracking-wider">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{template.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                <span className="text-ink-secondary text-[11px] truncate">{template.bestFor}</span>
                <button
                  type="button"
                  disabled={isSelected}
                  onClick={() => onSelect(template.id as CanonicalTemplate)}
                  className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-ink-muted disabled:no-underline"
                >
                  {isSelected ? "Active" : "Apply"}
                </button>
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}

