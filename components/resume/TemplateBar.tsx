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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-paper/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] text-ink-secondary">Resume design:</span>
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            {activeTemplateMeta.name}
            {activeTemplateMeta.isRecommended && (
              <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
                Recommended
              </span>
            )}
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">· {activeTemplateMeta.voice}</span>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Change design <ArrowRightIcon className="h-4 w-4" />
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
