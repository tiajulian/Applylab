import type { ResumeContent } from "@/types";
import { DEFAULT_DENSITY, type TemplateDensity } from "@/lib/resume/templateDensity";
import { TEMPLATE_METADATA } from "@/lib/resume/templateMetadata";
import { BaseResumeTemplate } from "@/components/templates/BaseResumeTemplate";

export function DesignForwardTemplate({
  resume,
  density = DEFAULT_DENSITY,
  highlights = {},
  onHighlightActivate,
}: {
  resume: ResumeContent;
  density?: TemplateDensity;
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
}) {
  return (
    <BaseResumeTemplate
      resume={resume}
      tokens={TEMPLATE_METADATA.modern.tokens}
      density={density}
      highlights={highlights}
      onHighlightActivate={onHighlightActivate}
    />
  );
}
