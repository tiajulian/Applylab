"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CANONICAL_TEMPLATE_LIST,
  canonicalTemplate,
  type TemplateMetadata,
} from "@/lib/resume/templateMetadata";
import type { CanonicalTemplate, Template } from "@/types";

function TemplateMiniThumbnail({ template }: { template: TemplateMetadata }) {
  const { tokens } = template;
  const isSerif = tokens.typeFamily === "Serif";
  const isMono = tokens.typeFamily === "Mono";
  const isMixed = tokens.typeFamily === "Mixed";
  const accent = tokens.accentColor ?? "#0f172a";

  return (
    <div
      className="relative flex h-36 w-full flex-col justify-between overflow-hidden rounded border border-border/80 bg-paper p-3 shadow-inner"
      style={{
        fontFamily: isSerif
          ? "Georgia, serif"
          : isMono
          ? "monospace"
          : "Arial, sans-serif",
      }}
    >
      {/* Header wireframe */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div
            className="h-2.5 rounded-sm"
            style={{
              width: template.id === "editorial" ? "55%" : "45%",
              backgroundColor: tokens.headingStyle === "accent_rule" ? accent : "#0f172a",
              fontFamily: isMixed ? "Georgia, serif" : undefined,
            }}
          />
          <div className="h-1.5 w-12 rounded-sm bg-ink-muted/30" />
        </div>
        <div className="h-1.5 w-2/3 rounded-sm bg-ink-muted/40" />
        <div className="h-1 w-4/5 rounded-sm bg-ink-muted/25" />
      </div>

      {/* Section 1 wireframe */}
      <div className="flex flex-col gap-1 pt-1">
        <div
          className="flex items-center gap-1.5"
          style={{
            borderBottom:
              tokens.ruleStyle === "none"
                ? "none"
                : tokens.ruleStyle === "accent"
                ? `1.5px solid ${accent}`
                : "1px solid #cbd5e1",
            paddingBottom: "2px",
          }}
        >
          {tokens.headingStyle === "mono_label" && (
            <span className="text-[7px] font-bold text-accent">{"//"}</span>
          )}
          <div
            className="h-1.5 rounded-sm"
            style={{
              width: "35%",
              backgroundColor: tokens.accentColor ?? "#334155",
            }}
          />
        </div>
        <div className="h-1 w-full rounded-sm bg-ink-muted/25" />
        <div className="h-1 w-5/6 rounded-sm bg-ink-muted/20" />
      </div>

      {/* Section 2 wireframe */}
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-1.5"
          style={{
            borderBottom:
              tokens.ruleStyle === "none"
                ? "none"
                : tokens.ruleStyle === "accent"
                ? `1.5px solid ${accent}`
                : "1px solid #cbd5e1",
            paddingBottom: "2px",
          }}
        >
          {tokens.headingStyle === "mono_label" && (
            <span className="text-[7px] font-bold text-accent">{"//"}</span>
          )}
          <div
            className="h-1.5 rounded-sm"
            style={{
              width: "40%",
              backgroundColor: tokens.accentColor ?? "#334155",
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1 w-1 rounded-full bg-ink-muted/40" />
          <div className="h-1 w-11/12 rounded-sm bg-ink-muted/25" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1 w-1 rounded-full bg-ink-muted/40" />
          <div className="h-1 w-4/5 rounded-sm bg-ink-muted/25" />
        </div>
      </div>
    </div>
  );
}

export function ChooseTemplateModal({
  isOpen,
  selectedTemplate = "clean",
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  selectedTemplate?: Template;
  onSelect: (template: CanonicalTemplate) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState<CanonicalTemplate>(canonicalTemplate(selectedTemplate));

  useEffect(() => {
    setActive(canonicalTemplate(selectedTemplate));
  }, [selectedTemplate, isOpen]);

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
                    className={`group relative flex flex-col rounded-lg border p-3.5 text-left transition-all duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? "border-accent bg-accent-soft/30 shadow-sm ring-2 ring-accent"
                        : "border-border bg-surface hover:border-ink-muted/50 hover:bg-paper-deep/50"
                    }`}
                  >
                    {/* Thumbnail Wireframe Preview */}
                    <TemplateMiniThumbnail template={template} />

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

                    <p className="mt-1 text-xs text-ink-muted line-clamp-2">
                      {template.description}
                    </p>

                    {/* Best for tag */}
                    <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                      <span className="text-ink-secondary truncate">
                        {template.voice}
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
                  onSelect(active);
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
