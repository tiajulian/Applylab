import { createElement } from "react";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import type { TemplateDensity } from "@/lib/resume/templateDensity";
import type { ResumeContent, Template } from "@/types";

/**
 * Renders a resume template to static HTML. The templates are "use client" modules (hooks, dnd-kit,
 * portals for the editable canvas), which the App Router turns into unrenderable client references
 * inside a route handler's server layer. next.config.mjs therefore pins THIS module to the "ssr"
 * layer (where they are ordinary components) and swaps its react-dom/server for
 * ./reactDomServerSsr.ts so the renderer and the templates share one React. Keep it a leaf:
 * server-layer callers import only this function, never the templates directly.
 */
export async function renderResumeMarkup(
  resume: ResumeContent,
  template: Template,
  density: TemplateDensity,
  accentColor?: string | null
): Promise<string> {
  // Dynamic: Next rejects a static react-dom/server import in server-layer files.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const definition = getTemplateDefinition(template);
  return renderToStaticMarkup(
    createElement(definition.component, {
      resume,
      density,
      accentColor: accentColor ?? definition.tokens.accentColor,
    })
  );
}
