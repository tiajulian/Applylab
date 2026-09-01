"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CANONICAL_TEMPLATE_LIST,
  canonicalTemplate,
  MODERN_CURATED_ACCENTS,
  type TemplateMetadata,
} from "@/lib/resume/templateMetadata";
import type { CanonicalTemplate, Template } from "@/types";

function TemplateMiniThumbnail({
  template,
  customAccentColor,
}: {
  template: TemplateMetadata;
  customAccentColor?: string | null;
}) {
  const { id, tokens } = template;
  const accent = customAccentColor ?? tokens.accentColor ?? "#1e3a8a";

  const font =
    tokens.typeFamily === "Serif"
      ? "Georgia, 'Times New Roman', serif"
      : tokens.typeFamily === "Mono"
      ? "ui-monospace, Consolas, monospace"
      : "Arial, Helvetica, sans-serif";

  const isClassic = id === "classic";
  const isModern = id === "modern";
  const isEditorial = id === "editorial";
  const isTechnical = id === "technical";
  const isExecutive = id === "executive";
  const isMinimal = id === "minimal";

  return (
    <div
      className="relative flex h-40 w-full flex-col justify-between overflow-hidden rounded bg-white p-2.5 shadow-xs ring-1 ring-slate-200 transition-shadow group-hover:shadow-sm"
      style={{ fontFamily: font }}
    >
      {/* Mini Page Content */}
      <div className="flex flex-col gap-1.5 text-[6.5px] leading-tight text-slate-800">
        {/* Header Block */}
        <div
          className={`flex flex-col ${isClassic ? "items-center text-center" : "items-start text-left"}`}
          style={{
            borderBottom: tokens.headerRule
              ? isModern
                ? `1.5px solid ${accent}`
                : "1px solid #cbd5e1"
              : "none",
            paddingBottom: tokens.headerRule ? "3px" : "1px",
          }}
        >
          {/* Candidate Name */}
          <div
            className={`font-bold ${isExecutive ? "tracking-widest uppercase text-[6px]" : "text-[8px]"}`}
            style={{
              color: isModern ? accent : "#0f172a",
              fontFamily: isEditorial ? "Georgia, serif" : undefined,
            }}
          >
            Alex Morgan
          </div>

          {/* Contact Line */}
          <div className="text-[5px] text-slate-500 mt-0.5">
            {isClassic ? (
              <>
                <div>alex@example.com · 0400 000 000</div>
                <div>Sydney, NSW · Permanent Resident</div>
              </>
            ) : (
              <div>alex@example.com | 0400 000 000 | Sydney, NSW</div>
            )}
          </div>
        </div>

        {/* Section 1 */}
        <div className="flex flex-col">
          {/* Section Heading */}
          <div
            className={`flex items-center justify-between pb-0.5 font-bold ${
              isMinimal ? "normal-case text-[6.5px]" : "uppercase text-[6px]"
            }`}
            style={{
              color: isModern ? accent : isEditorial ? "#64748b" : isExecutive ? "#78716c" : "#0f172a",
              letterSpacing: isExecutive ? "0.1em" : isEditorial ? "0.08em" : undefined,
              fontFamily: isTechnical ? "monospace" : undefined,
              borderBottom:
                tokens.ruleStyle === "full"
                  ? "1px solid #0f172a"
                  : tokens.ruleStyle === "hairline"
                  ? "1px solid #cbd5e1"
                  : tokens.ruleStyle === "mono"
                  ? "1px solid #475569"
                  : "none",
            }}
          >
            <span>
              {isTechnical ? "// SKILLS" : isExecutive ? "PROFILE" : isMinimal ? "Summary" : "SUMMARY"}
            </span>
          </div>

          {isTechnical ? (
            /* Technical shows skills block first */
            <div className="flex flex-col gap-0.5 text-[5px] text-slate-700 mt-0.5">
              <div><strong className="text-slate-900">Languages:</strong> TypeScript, Python, SQL</div>
              <div><strong className="text-slate-900">Cloud & Data:</strong> AWS, Snowflake, dbt</div>
            </div>
          ) : (
            /* Summary Text Lines */
            <div className="text-[5px] text-slate-600 leading-snug mt-0.5 line-clamp-2">
              Results-driven professional with deep expertise in scalable architecture and cross-functional leadership.
            </div>
          )}
        </div>

        {/* Section 2: Experience */}
        <div className="flex flex-col">
          <div
            className={`flex items-center justify-between pb-0.5 font-bold ${
              isMinimal ? "normal-case text-[6.5px]" : "uppercase text-[6px]"
            }`}
            style={{
              color: isModern ? accent : isEditorial ? "#64748b" : isExecutive ? "#78716c" : "#0f172a",
              letterSpacing: isExecutive ? "0.1em" : isEditorial ? "0.08em" : undefined,
              fontFamily: isTechnical ? "monospace" : undefined,
              borderBottom:
                tokens.ruleStyle === "full"
                  ? "1px solid #0f172a"
                  : tokens.ruleStyle === "hairline"
                  ? "1px solid #cbd5e1"
                  : tokens.ruleStyle === "mono"
                  ? "1px solid #475569"
                  : "none",
            }}
          >
            <span>
              {isTechnical ? "// EXPERIENCE" : isMinimal ? "Experience" : "EXPERIENCE"}
            </span>
          </div>

          {/* Role Header */}
          <div className="mt-0.5 flex flex-col text-[5.5px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900" style={{ fontFamily: isEditorial ? "Georgia, serif" : undefined }}>
                Senior Lead · Tech Corp
              </span>
              <span className="text-[5px] text-slate-500" style={{ fontFamily: isTechnical ? "monospace" : undefined }}>
                {isTechnical ? "2024-01 – Present" : "2024 – Present"}
              </span>
            </div>

            {isClassic && (
              <div className="italic text-[4.8px] text-slate-500">Sydney, Australia</div>
            )}

            {/* Bullets */}
            <div className="mt-0.5 flex flex-col gap-0.5 text-[5px] text-slate-600">
              <div className="flex items-start gap-1">
                <span>•</span>
                <span className="truncate">Led cloud migration delivering 35% latency reduction.</span>
              </div>
              {!isExecutive && (
                <div className="flex items-start gap-1">
                  <span>•</span>
                  <span className="truncate">Mentored 8 engineers across distributed teams.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChooseTemplateModal({
  isOpen,
  selectedTemplate = "clean",
  selectedAccentColor,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  selectedTemplate?: Template;
  selectedAccentColor?: string | null;
  onSelect: (template: CanonicalTemplate, accentColor?: string | null) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState<CanonicalTemplate>(canonicalTemplate(selectedTemplate));
  const [modernAccent, setModernAccent] = useState<string>(selectedAccentColor ?? "#1e3a8a");

  useEffect(() => {
    setActive(canonicalTemplate(selectedTemplate));
    if (selectedAccentColor) setModernAccent(selectedAccentColor);
  }, [selectedTemplate, selectedAccentColor, isOpen]);

  if (!isOpen) return null;

  const currentMeta = CANONICAL_TEMPLATE_LIST.find((t) => t.id === active);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-surface shadow-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-template-title"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border p-5 sm:px-8 sm:py-6">
            <div>
              <h2 id="choose-template-title" className="font-display text-h3 text-ink">
                Choose your template
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                All 8 templates are strictly ATS-safe, single-column, and SEEK-optimized. Switch freely at any time.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close dialog"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Body: Responsive Grid of 8 templates */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CANONICAL_TEMPLATE_LIST.map((template) => {
                const isSelected = template.id === active;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setActive(template.id as CanonicalTemplate)}
                    className={`group relative flex flex-col rounded-lg border p-3 text-left transition-all duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? "border-accent bg-accent-soft/30 shadow-sm ring-2 ring-accent"
                        : "border-border bg-surface hover:border-ink-muted/50 hover:bg-paper-deep/50"
                    }`}
                  >
                    {/* Real Miniature Preview */}
                    <TemplateMiniThumbnail
                      template={template}
                      customAccentColor={template.id === "modern" ? modernAccent : null}
                    />

                    {/* Meta info */}
                    <div className="mt-3 flex items-center justify-between gap-1">
                      <span className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {template.name}
                        {template.isRecommended && (
                          <Badge variant="accent" className="text-[10px] uppercase font-bold py-0.5 px-1.5">
                            Recommended
                          </Badge>
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-ink-muted">
                        {template.tokens.typeFamily}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                      {template.description}
                    </p>

                    {/* Best for tag */}
                    <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                      <span className="text-ink-secondary truncate">
                        {template.bestFor}
                      </span>
                      {isSelected && (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modern Curated Accent Swatches */}
            {active === "modern" && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-paper/60 p-3.5">
                <div>
                  <span className="text-xs font-semibold text-ink">Modern Accent Color:</span>
                  <span className="ml-2 text-xs text-ink-secondary">
                    {MODERN_CURATED_ACCENTS.find((a) => a.hex === modernAccent)?.name ?? "Deep Navy"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {MODERN_CURATED_ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      onClick={() => setModernAccent(accent.hex)}
                      className={`h-6 w-6 rounded-full transition-transform ${accent.className} ${
                        modernAccent === accent.hex
                          ? "ring-2 ring-accent ring-offset-2 scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      title={accent.name}
                      aria-label={accent.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border bg-paper/40 p-4 sm:px-8">
            <div className="text-xs text-ink-secondary">
              {currentMeta ? (
                <span>
                  <strong className="font-medium text-ink">{currentMeta.name}</strong> ({currentMeta.voice}) selected
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onSelect(active, active === "modern" ? modernAccent : null);
                  onClose();
                }}
              >
                Apply template
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

