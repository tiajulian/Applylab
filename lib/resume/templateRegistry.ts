import type { ComponentType } from "react";
import { ATSSafeTemplate } from "@/components/templates/ATSSafeTemplate";
import { DesignForwardTemplate } from "@/components/templates/DesignForwardTemplate";
import { DEFAULT_TEMPLATE, TEMPLATE_METADATA, type TemplateMetadata } from "@/lib/resume/templateMetadata";
import type { TemplateDensity } from "@/lib/resume/templateDensity";
import type { ResumeContent, Template } from "@/types";

type TemplateComponentProps = {
  resume: ResumeContent;
  density?: TemplateDensity;
  /** See components/templates/shared.tsx#HighlightSpan - optional, so every existing caller
   * (PDF/DOCX export's pageFit.ts, and this registry's own consumers that never pass them)
   * renders exactly as before. */
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
};

export interface TemplateDefinition extends TemplateMetadata {
  component: ComponentType<TemplateComponentProps>;
}

const COMPONENTS: Record<Template, ComponentType<TemplateComponentProps>> = {
  "ats-safe": ATSSafeTemplate,
  "design-forward": DesignForwardTemplate,
};

export const TEMPLATE_REGISTRY: Record<Template, TemplateDefinition> = Object.fromEntries(
  Object.entries(TEMPLATE_METADATA).map(([id, meta]) => [id, { ...meta, component: COMPONENTS[id as Template] }])
) as Record<Template, TemplateDefinition>;

export const TEMPLATE_LIST: TemplateDefinition[] = Object.values(TEMPLATE_REGISTRY);

/** Looks up a template definition, falling back to the default if the id is unknown — e.g. a
 * template removed from the registry after being referenced by an old resume row. */
export function getTemplateDefinition(id: Template): TemplateDefinition {
  return TEMPLATE_REGISTRY[id] ?? TEMPLATE_REGISTRY[DEFAULT_TEMPLATE];
}

export { isValidTemplate } from "@/lib/resume/templateMetadata";
