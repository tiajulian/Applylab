"use client";

import { useState } from "react";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { CANONICAL_TEMPLATE_LIST } from "@/lib/resume/templateMetadata";
import { trackFunnelEvent } from "@/lib/analytics";
import type { CanonicalTemplate } from "@/types";
import { ArrowRightIcon } from "@/components/ui/icons/LucideIcons";

/** The "Template: X · Change template" entry bar shared by both creation forms, with its picker modal. */
export function TemplateBar({
  selectedTemplate,
  onSelect,
}: {
  selectedTemplate: CanonicalTemplate;
  onSelect: (template: CanonicalTemplate) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const activeTemplateMeta = CANONICAL_TEMPLATE_LIST.find((t) => t.id === selectedTemplate) ?? CANONICAL_TEMPLATE_LIST[0];

  function handleOpen() {
    trackFunnelEvent("template_picker_shown", { source: "creation_form", currentTemplate: selectedTemplate });
    setIsOpen(true);
  }

  function handleSelect(next: CanonicalTemplate) {
    trackFunnelEvent("template_selected", { templateId: next, source: "creation_form" });
    onSelect(next);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/80 bg-paper/60 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Template:</span>
          <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
            {activeTemplateMeta.name}
            {activeTemplateMeta.isRecommended && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Recommended
              </span>
            )}
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">· {activeTemplateMeta.voice}</span>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Change template <ArrowRightIcon className="ml-1 inline h-4 w-4 align-text-bottom" />
        </button>
      </div>

      <ChooseTemplateModal
        isOpen={isOpen}
        selectedTemplate={selectedTemplate}
        onSelect={handleSelect}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
