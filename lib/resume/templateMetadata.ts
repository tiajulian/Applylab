import type { CanonicalTemplate, Template } from "@/types";

export interface CuratedAccent {
  id: string;
  name: string;
  hex: string;
  className: string;
}

export const MODERN_CURATED_ACCENTS: readonly CuratedAccent[] = [
  { id: "navy", name: "Deep Navy", hex: "#1e3a8a", className: "bg-blue-900" },
  { id: "forest", name: "Forest Green", hex: "#14532d", className: "bg-emerald-900" },
  { id: "burgundy", name: "Rich Burgundy", hex: "#831843", className: "bg-rose-900" },
  { id: "charcoal", name: "Slate Charcoal", hex: "#334155", className: "bg-slate-700" },
] as const;

export interface TemplateTokens {
  /** CSS font-family string for the body, contact, and bullets. */
  fontFamily: string;
  /** Primary font name used by the docx export engine. */
  docxFont: string;
  /** Optional separate heading font family (e.g. monospace for Technical, serif for Editorial display). */
  headingFontFamily?: string;
  /** Optional separate font family for role titles (e.g. Georgia for Editorial). */
  roleTitleFontFamily?: string;
  /** Primary heading visual style archetype. */
  headingStyle:
    | "caps_rule"
    | "smallcaps_rule"
    | "accent_unruled"
    | "compact_unruled"
    | "editorial_grey_unruled"
    | "mono_label"
    | "executive_grey_unruled"
    | "plain_sentence_case";
  /** Header block alignment. */
  headerAlignment: "left" | "center";
  /** Whether the header block has a bottom divider rule. */
  headerRule: boolean;
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
    letterSpacing?: string;
    fontStyle?: "italic" | "normal";
  };
  /** Section divider rule style. */
  ruleStyle: "full" | "hairline" | "accent" | "mono" | "understated" | "none";
  /** Visual type family category. */
  typeFamily: "Sans" | "Serif" | "Mixed" | "Mono";
  /** Location display style for experience roles. */
  locationStyle: "inline" | "subline_italic";
  /** Date format: standard (e.g. June 2026 - Present) or iso_mono (2026-06 - Present in monospace). */
  dateFormat: "standard" | "iso_mono";
  /** Section order: standard or skills promoted above experience. */
  sectionOrder: "standard" | "skills_first";
  /** Custom titles for standard sections if overridden by template (e.g. Executive Profile / Capabilities). */
  sectionTitles?: {
    summary?: string;
    experience?: string;
    skills?: string;
    tools?: string;
    projects?: string;
    education?: string;
    referees?: string;
  };
  /** Bullet density guidance for the template. */
  bulletGuidance?: string;
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
    description: "Neutral universal default with full-width section rules for unmistakable ATS landmarks.",
    voice: "Neutral, universal",
    bestFor: "Broad applications, any industry or career stage",
    isRecommended: true,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-slate-900",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "caps_rule",
      headerAlignment: "left",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-slate-900",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 700, casing: "none" },
      ruleStyle: "full",
      typeFamily: "Sans",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
    },
  },
  classic: {
    id: "classic",
    canonicalId: "classic",
    name: "Classic",
    description: "Traditional serif styling with centered header, light hairline rules, and italic location lines.",
    voice: "Traditional, conservative",
    bestFor: "Finance, law, government, education, and corporate roles",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-stone-800",
    tokens: {
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      docxFont: "Georgia",
      headingStyle: "smallcaps_rule",
      headerAlignment: "center",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-stone-800",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 700, casing: "none" },
      ruleStyle: "hairline",
      typeFamily: "Serif",
      locationStyle: "subline_italic",
      dateFormat: "standard",
      sectionOrder: "standard",
    },
  },
  modern: {
    id: "modern",
    canonicalId: "modern",
    name: "Modern",
    description: "Contemporary layout with a single curated accent on name and header, separating with color.",
    voice: "Contemporary, confident",
    bestFor: "Tech, marketing, startups, and creative professional roles",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-blue-900",
    tokens: {
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      docxFont: "Arial",
      headingStyle: "accent_unruled",
      headerAlignment: "left",
      headerRule: true,
      accentColor: "#1e3a8a", // Deep Navy default
      accentClassName: "bg-blue-900",
      density: "balanced",
      nameStyle: { fontPtDelta: 8, fontWeight: 800, casing: "none" },
      ruleStyle: "none",
      typeFamily: "Sans",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
    },
  },
  compact: {
    id: "compact",
    canonicalId: "compact",
    name: "Compact",
    description: "High-capacity single-page layout with narrower margins, tighter density, and no divider rules.",
    voice: "Efficient, high-capacity",
    bestFor: "Extensive career histories and multi-role senior profiles",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-slate-700",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "compact_unruled",
      headerAlignment: "left",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-slate-700",
      density: "dense",
      nameStyle: { fontPtDelta: 6, fontWeight: 700, casing: "none" },
      ruleStyle: "none",
      typeFamily: "Sans",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
    },
  },
  editorial: {
    id: "editorial",
    canonicalId: "editorial",
    name: "Editorial",
    description: "Distinguished mixed pairing of serif display headers over sans body with quiet wide-tracked labels.",
    voice: "Polished, distinguished",
    bestFor: "Communications, strategy, design-adjacent, and media",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-amber-950",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingFontFamily: "Arial, Helvetica, sans-serif",
      roleTitleFontFamily: "Georgia, 'Times New Roman', Times, serif",
      headingStyle: "editorial_grey_unruled",
      headerAlignment: "left",
      headerRule: true,
      accentColor: null,
      accentClassName: "bg-amber-950",
      density: "balanced",
      nameStyle: {
        fontPtDelta: 10,
        fontWeight: 700,
        fontFamily: "Georgia, 'Times New Roman', Times, serif",
        casing: "none",
        letterSpacing: "0.01em",
      },
      ruleStyle: "none",
      typeFamily: "Mixed",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
    },
  },
  technical: {
    id: "technical",
    canonicalId: "technical",
    name: "Technical",
    description: "Structured keyword-forward layout promoting skills above experience with ISO monospace dates.",
    voice: "Keyword-forward, structured",
    bestFor: "Software engineering, data, cloud architecture, and IT",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-indigo-900",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingFontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      headingStyle: "mono_label",
      headerAlignment: "left",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-indigo-900",
      density: "dense",
      nameStyle: { fontPtDelta: 8, fontWeight: 800, casing: "none" },
      ruleStyle: "mono",
      typeFamily: "Mono",
      locationStyle: "inline",
      dateFormat: "iso_mono",
      sectionOrder: "skills_first",
    },
  },
  executive: {
    id: "executive",
    canonicalId: "executive",
    name: "Executive",
    description: "Understated serif presentation with tracked capitals, wide margins, and Profile / Capabilities structure.",
    voice: "Understated, senior",
    bestFor: "Directors, VPs, executives, and leadership appointments",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-stone-900",
    tokens: {
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      docxFont: "Georgia",
      headingStyle: "executive_grey_unruled",
      headerAlignment: "left",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-stone-900",
      density: "airy",
      nameStyle: {
        fontPtDelta: 8,
        fontWeight: 700,
        casing: "uppercase",
        letterSpacing: "0.12em",
      },
      ruleStyle: "none",
      typeFamily: "Serif",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
      sectionTitles: {
        summary: "Profile",
        skills: "Capabilities",
      },
      bulletGuidance: "Reads best with two high-impact bullets per role.",
    },
  },
  minimal: {
    id: "minimal",
    canonicalId: "minimal",
    name: "Minimal",
    description: "Airy, unadorned layout with unruled sentence-case headings structured purely by whitespace.",
    voice: "Airy, content-first",
    bestFor: "Candidates wanting pure content without lines or ornamentation",
    isRecommended: false,
    isAtsSafe: true,
    tier: "free",
    proOnly: false,
    accentClassName: "bg-zinc-500",
    tokens: {
      fontFamily: "Arial, Helvetica, sans-serif",
      docxFont: "Arial",
      headingStyle: "plain_sentence_case",
      headerAlignment: "left",
      headerRule: false,
      accentColor: null,
      accentClassName: "bg-zinc-500",
      density: "airy",
      nameStyle: { fontPtDelta: 7, fontWeight: 700, casing: "none" },
      ruleStyle: "none",
      typeFamily: "Sans",
      locationStyle: "inline",
      dateFormat: "standard",
      sectionOrder: "standard",
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

