import type { CanonicalTemplate, Template } from "@/types";

export interface TemplateTokens {
  /** CSS font-family string for the body, contact, and bullets. */
  fontFamily: string;
  /** Primary font name used by the docx export engine. */
  docxFont: string;
  /** Optional separate heading font family (e.g. monospace for Technical, serif for Editorial display). */
  headingFontFamily?: string;
  /** Primary heading visual style archetype. */
  headingStyle:
    | "caps_rule"
    | "smallcaps_rule"
    | "accent_rule"
    | "compact_rule"
    | "editorial_rule"
    | "mono_label"
    | "executive_rule"
    | "plain";
  /** Hex color for headings/rules if accented, or null for pure ink. */
  accentColor: string | null;
  /** Tailwind background color class for the palette swatch. */
  accentClassName: string;
  /** Default density profile. */
  density: "airy" | "balanced" | "dense";
  /** Header / candidate name styling adjustments. */
  nameStyle: {
    fontPtDelta: number;
    fontWeight: number;
    fontFamily?: string;
    casing?: "uppercase" | "none";
    fontStyle?: "italic" | "normal";
  };
  /** Section divider rule style. */
  ruleStyle: "hairline" | "medium" | "accent" | "mono" | "understated" | "none";
  /** Visual type family category. */
  typeFamily: "Sans" | "Serif" | "Mixed" | "Mono";
}

export interface TemplateMetadata {
  id: Template;
  canonicalId: CanonicalTemplate;
  name: string;
  description: string;
  voice: string;
  bestFor: string;
  isRecommended: boolean;
  isAtsSafe: boolean;
  tier: "free" | "pro";
  /** Retained for backward-compatible interface access across existing UI components. */
  proOnly: boolean;
  accentClassName: string;
  tokens: TemplateTokens;
}

export const CANONICAL_TEMPLATES: readonly CanonicalTemplate[] = [
  "clean",
  "classic",
  "modern",
  "compact",
  "editorial",
  "technical",
  "executive",
  "minimal",
] as const;

export const DEFAULT_TEMPLATE: CanonicalTemplate = "clean";

const CANONICAL_REGISTRY: Record<CanonicalTemplate, TemplateMetadata> = {
  clean: {
    id: "clean",
    canonicalId: "clean",
    name: "Clean",
    description: "Neutral, universal, and maximum parseability with crisp typography and subtle divider rules.",
    voice: "Neutral, universal, safest",
    bestFor: "Anyone, any industry — the default choice",
    isRecommended: true,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-slate-900",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "caps_rule",
      accentColor: null,
      accentClassName: "bg-slate-900",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 700, casing: "none" },
      ruleStyle: "hairline",
      typeFamily: "Sans",
    },
  },
  classic: {
    id: "classic",
    canonicalId: "classic",
    name: "Classic",
    description: "Traditional, conservative styling with refined serif typography and small-caps headings.",
    voice: "Traditional, conservative",
    bestFor: "Finance, law, government, operations, and corporate",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-stone-800",
    tokens: {
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      docxFont: "Georgia",
      headingStyle: "smallcaps_rule",
      accentColor: null,
      accentClassName: "bg-stone-800",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 700, casing: "none" },
      ruleStyle: "hairline",
      typeFamily: "Serif",
    },
  },
  modern: {
    id: "modern",
    canonicalId: "modern",
    name: "Modern",
    description: "Contemporary, tidy layout featuring a single restrained deep navy accent color.",
    voice: "Contemporary, tidy",
    bestFor: "General professional, mid-career, tech, and marketing",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-blue-800",
    tokens: {
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      docxFont: "Arial",
      headingStyle: "accent_rule",
      accentColor: "#1e3a8a", // Deep Navy
      accentClassName: "bg-blue-800",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 800, casing: "none" },
      ruleStyle: "accent",
      typeFamily: "Sans",
    },
  },
  compact: {
    id: "compact",
    canonicalId: "compact",
    name: "Compact",
    description: "Efficient, high-capacity formatting optimized for comprehensive career histories.",
    voice: "Efficient, high-capacity",
    bestFor: "Senior profiles and extensive experience needing 1 page",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-slate-700",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "compact_rule",
      accentColor: null,
      accentClassName: "bg-slate-700",
      density: "dense",
      nameStyle: { fontPtDelta: 6, fontWeight: 700, casing: "none" },
      ruleStyle: "hairline",
      typeFamily: "Sans",
    },
  },
  editorial: {
    id: "editorial",
    canonicalId: "editorial",
    name: "Editorial",
    description: "Polished rhythm pairing a distinguished serif display name with a crisp sans body.",
    voice: "Polished, warm presence",
    bestFor: "Design-adjacent, communications, strategy, and media",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-amber-900",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingFontFamily: "Georgia, 'Times New Roman', serif",
      headingStyle: "editorial_rule",
      accentColor: "#334155", // Slate
      accentClassName: "bg-amber-900",
      density: "balanced",
      nameStyle: {
        fontPtDelta: 10,
        fontWeight: 700,
        fontFamily: "Georgia, 'Times New Roman', serif",
        casing: "none",
      },
      ruleStyle: "hairline",
      typeFamily: "Mixed",
    },
  },
  technical: {
    id: "technical",
    canonicalId: "technical",
    name: "Technical",
    description: "Structured, keyword-forward layout with monospace section labels and high clarity.",
    voice: "Keyword-forward, structured",
    bestFor: "Engineering, software development, data, and IT",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-indigo-700",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingFontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      headingStyle: "mono_label",
      accentColor: "#1e293b", // Slate 800
      accentClassName: "bg-indigo-700",
      density: "dense",
      nameStyle: { fontPtDelta: 8, fontWeight: 800, casing: "none" },
      ruleStyle: "mono",
      typeFamily: "Mono",
    },
  },
  executive: {
    id: "executive",
    canonicalId: "executive",
    name: "Executive",
    description: "Understated, senior presentation with refined serif typography and generous whitespace.",
    voice: "Understated, senior",
    bestFor: "Leadership, directors, VP+, and executives",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-stone-900",
    tokens: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      docxFont: "Georgia",
      headingStyle: "executive_rule",
      accentColor: null,
      accentClassName: "bg-stone-900",
      density: "airy",
      nameStyle: { fontPtDelta: 9, fontWeight: 700, casing: "none" },
      ruleStyle: "understated",
      typeFamily: "Serif",
    },
  },
  minimal: {
    id: "minimal",
    canonicalId: "minimal",
    name: "Minimal",
    description: "Ultra-clean, airy layout where hierarchy is expressed purely through whitespace and typography.",
    voice: "Ultra-clean, airy",
    bestFor: "Candidates wanting pure content without lines or borders",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-zinc-400",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "plain",
      accentColor: null,
      accentClassName: "bg-zinc-400",
      density: "airy",
      nameStyle: { fontPtDelta: 8, fontWeight: 700, casing: "none" },
      ruleStyle: "none",
      typeFamily: "Sans",
    },
  },
};

export const TEMPLATE_METADATA: Record<Template, TemplateMetadata> = {
  ...CANONICAL_REGISTRY,
  "ats-safe": {
    ...CANONICAL_REGISTRY.clean,
    id: "ats-safe",
    canonicalId: "clean",
  },
  "design-forward": {
    ...CANONICAL_REGISTRY.modern,
    id: "design-forward",
    canonicalId: "modern",
  },
};

export const CANONICAL_TEMPLATE_LIST: TemplateMetadata[] = CANONICAL_TEMPLATES.map(
  (id) => CANONICAL_REGISTRY[id]
);

export const TEMPLATE_METADATA_LIST: TemplateMetadata[] = CANONICAL_TEMPLATE_LIST;

/**
 * Resolves any template identifier (including legacy aliases) to a canonical template ID.
 */
export function canonicalTemplate(value: unknown): CanonicalTemplate {
  if (typeof value === "string") {
    if (value === "ats-safe") return "clean";
    if (value === "design-forward") return "modern";
    if (value in CANONICAL_REGISTRY) return value as CanonicalTemplate;
  }
  return DEFAULT_TEMPLATE;
}

export function isValidTemplate(value: unknown): value is Template {
  return typeof value === "string" && value in TEMPLATE_METADATA;
}
