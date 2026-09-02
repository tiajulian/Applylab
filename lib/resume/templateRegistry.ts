import type { ComponentType } from "react";
import { createElement } from "react";
import { BaseResumeTemplate } from "@/components/templates/BaseResumeTemplate";
import {
  CANONICAL_TEMPLATES,
  DEFAULT_TEMPLATE,
  TEMPLATE_METADATA,
  canonicalTemplate,
  type TemplateMetadata,
} from "@/lib/resume/templateMetadata";
import type { TemplateDensity } from "@/lib/resume/templateDensity";
import type { CanonicalTemplate, ResumeContent, Template } from "@/types";

export type TemplateComponentProps = {
  resume: ResumeContent;
  density?: TemplateDensity;
  accentColor?: string | null;
  /** See components/templates/shared.tsx#HighlightSpan - optional, so every existing caller
   * (PDF/DOCX export's pageFit.ts, and this registry's own consumers that never pass them)
   * renders exactly as before. */
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  activeSection?: string | null;
  onSectionClick?: (sectionId: string) => void;
};

export interface TemplateDefinition extends TemplateMetadata {
  component: ComponentType<TemplateComponentProps>;
}

function createTemplateComponent(templateId: Template): ComponentType<TemplateComponentProps> {
  const meta = TEMPLATE_METADATA[templateId] ?? TEMPLATE_METADATA[DEFAULT_TEMPLATE];
  return function TemplateComponent(props: TemplateComponentProps) {
    return createElement(BaseResumeTemplate, {
      ...props,
      tokens: meta.tokens,
      accentColor: props.accentColor ?? meta.tokens.accentColor,
    });
  };
}


export const CleanTemplate = createTemplateComponent("clean");
export const ClassicTemplate = createTemplateComponent("classic");
export const ModernTemplate = createTemplateComponent("modern");
export const CompactTemplate = createTemplateComponent("compact");
export const EditorialTemplate = createTemplateComponent("editorial");
export const TechnicalTemplate = createTemplateComponent("technical");
export const ExecutiveTemplate = createTemplateComponent("executive");
export const MinimalTemplate = createTemplateComponent("minimal");

// Backward compatibility alias components
export const ATSSafeTemplate = CleanTemplate;
export const DesignForwardTemplate = ModernTemplate;

const COMPONENTS: Record<Template, ComponentType<TemplateComponentProps>> = {
  clean: CleanTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  compact: CompactTemplate,
  editorial: EditorialTemplate,
  technical: TechnicalTemplate,
  executive: ExecutiveTemplate,
  minimal: MinimalTemplate,
  "ats-safe": ATSSafeTemplate,
  "design-forward": DesignForwardTemplate,
};

export const TEMPLATE_REGISTRY: Record<Template, TemplateDefinition> = Object.fromEntries(
  Object.entries(TEMPLATE_METADATA).map(([id, meta]) => [
    id,
    { ...meta, component: COMPONENTS[id as Template] ?? CleanTemplate },
  ])
) as Record<Template, TemplateDefinition>;

export const TEMPLATE_LIST: TemplateDefinition[] = CANONICAL_TEMPLATES.map(
  (id) => TEMPLATE_REGISTRY[id]
);

/** Looks up a template definition, falling back to the default if the id is unknown — e.g. a
 * template removed from the registry after being referenced by an old resume row. */
export function getTemplateDefinition(id: Template | string | null | undefined): TemplateDefinition {
  const canonical = canonicalTemplate(id);
  return TEMPLATE_REGISTRY[canonical] ?? TEMPLATE_REGISTRY[DEFAULT_TEMPLATE];
}

export { isValidTemplate, canonicalTemplate } from "@/lib/resume/templateMetadata";
