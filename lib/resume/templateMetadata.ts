import type { Template } from "@/types";

// Plain data only — no React component imports — so server code (API routes) can read
// template metadata (in particular `proOnly`) without pulling client template components
// into a server bundle.
export interface TemplateMetadata {
  id: Template;
  name: string;
  description: string;
  proOnly: boolean;
  /** Tailwind background-colour class for the small style swatch shown in the picker. */
  accentClassName: string;
}

export const TEMPLATE_METADATA: Record<Template, TemplateMetadata> = {
  "ats-safe": {
    id: "ats-safe",
    name: "ATS Safe",
    description: "Single-column, plain formatting built to parse cleanly through SEEK, PageUp, and Workday.",
    proOnly: false,
    accentClassName: "bg-gray-400",
  },
  "design-forward": {
    id: "design-forward",
    name: "Design Forward",
    description: "A more visual layout with accent colour and skill pills.",
    proOnly: true,
    accentClassName: "bg-brand-600",
  },
};

export const TEMPLATE_METADATA_LIST: TemplateMetadata[] = Object.values(TEMPLATE_METADATA);
export const DEFAULT_TEMPLATE: Template = "ats-safe";

export function isValidTemplate(value: unknown): value is Template {
  return typeof value === "string" && value in TEMPLATE_METADATA;
}
