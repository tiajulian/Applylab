"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircleIcon, CheckCircleIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import {
  ACCENT_SWATCHES,
  FONT_CHOICES,
  LINE_HEIGHT_PRESETS,
  MARGIN_PRESETS,
  SPACING_PRESETS,
  isFontChoiceId,
  type FontChoiceId,
  type LineHeightPreset,
  type MarginPreset,
  type SpacingPreset,
} from "@/lib/resume/designPrefs";
import type { FontSizePt } from "@/lib/resume/templateDensity";

const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
const PRESET_LABEL: Record<MarginPreset | SpacingPreset | LineHeightPreset, string> = {
  compact: "Compact",
  standard: "Standard",
  spacious: "Spacious",
  relaxed: "Relaxed",
};

export interface DesignPanelProps {
  isMobile: boolean;
  accentColor: string | null;
  fontChoice: FontChoiceId | null;
  marginPreset: MarginPreset | null;
  spacingPreset: SpacingPreset | null;
  lineHeightPreset: LineHeightPreset | null;
  onSelectAccentColor: (value: string | null) => void;
  onSelectFontChoice: (value: FontChoiceId | null) => void;
  onSelectMarginPreset: (value: MarginPreset | null) => void;
  onSelectSpacingPreset: (value: SpacingPreset | null) => void;
  onSelectLineHeightPreset: (value: LineHeightPreset | null) => void;
  /** Folded in from the toolbar's old, separate "Design & Font" popover (ViewSettingsPopover,
   * now retired) so there's one place for every appearance control, not two things both calling
   * themselves "Design & Font". */
  fontSizePt: FontSizePt;
  onSelectFontSize: (value: FontSizePt) => void;
  totalPages: number;
  onFitToOnePage: () => void;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {children}
    </div>
  );
}

/** A 3-way compact/standard/spacious(-or-relaxed) control, shared by the margin/spacing/
 * line-height rows below - each preset is a closed, curated set (lib/resume/designPrefs.ts), so a
 * segmented control (not a slider) is the right widget: every value is a deliberate, named choice. */
function PresetSegmented<T extends MarginPreset | SpacingPreset | LineHeightPreset>({
  presets,
  value,
  onChange,
  ariaLabel,
}: {
  presets: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  ariaLabel: string;
}) {
  const current = value ?? "standard";
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={current === preset}
          onClick={() => onChange(preset === "standard" ? null : preset)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-fast ease-editorial ${focusRing} ${
            current === preset ? "bg-accent text-on-accent" : "text-ink-secondary hover:bg-paper-deep"
          }`}
        >
          {PRESET_LABEL[preset]}
        </button>
      ))}
    </div>
  );
}

/**
 * The Design & Font panel: docked alongside the canvas the same way the Review panel is, offering
 * the five per-resume overrides lib/resume/designPrefs.ts defines (font, accent color, margin,
 * spacing, line height - columns and a signature were explicitly excluded from this feature).
 * Every option is a small curated set rendered directly (no free color/font picker, no slider),
 * matching the same ATS-safety reasoning that kept the font list curated in the first place.
 */
export function DesignPanel(props: DesignPanelProps) {
  const {
    isMobile,
    accentColor,
    fontChoice,
    marginPreset,
    spacingPreset,
    lineHeightPreset,
    onSelectAccentColor,
    onSelectFontChoice,
    onSelectMarginPreset,
    onSelectSpacingPreset,
    onSelectLineHeightPreset,
    fontSizePt,
    onSelectFontSize,
    totalPages,
    onFitToOnePage,
    onClose,
  } = props;
  const fitsOnePage = totalPages <= 1;
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  return (
    <aside
      ref={rootRef}
      id="design-panel"
      role="dialog"
      aria-labelledby="design-panel-title"
      aria-modal={isMobile ? true : undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={
        isMobile
          ? "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-paper focus:outline-none"
          : "relative flex h-full w-[360px] max-w-full shrink-0 flex-col overflow-y-auto rounded-xl border border-border/80 bg-paper focus:outline-none"
      }
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 id="design-panel-title" className="font-display text-base leading-tight text-ink">Design & Font</h2>
          <p className="mt-0.5 text-xs text-ink-secondary">Changes save automatically and apply to your PDF and DOCX exports.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close design panel"
          className={`-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-paper-deep hover:text-ink ${focusRing}`}
        >
          <XIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-col gap-5 px-4 pb-6">
        <Row label="Font">
          <select
            aria-label="Font"
            value={fontChoice ?? "default"}
            onChange={(e) => {
              const next = e.target.value;
              onSelectFontChoice(next === "default" ? null : isFontChoiceId(next) ? next : null);
            }}
            style={{ fontFamily: fontChoice ? FONT_CHOICES.find((f) => f.id === fontChoice)?.fontFamily : undefined }}
            className={`w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink ${focusRing}`}
          >
            <option value="default" style={{ fontFamily: "inherit" }}>Default (template&apos;s own font)</option>
            {FONT_CHOICES.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.fontFamily }}>
                {font.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Font size">
          <div className="flex items-center justify-between gap-2">
            <FontSizeStepper value={fontSizePt} onChange={onSelectFontSize} />
          </div>
        </Row>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-ink-secondary">
            {totalPages} {totalPages === 1 ? "page" : "pages"}
          </span>
          {fitsOnePage ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
              <CheckCircleIcon className="h-3 w-3" strokeWidth={2} />
              Fits on one page
            </span>
          ) : (
            <button
              type="button"
              onClick={onFitToOnePage}
              title="One page is safer for most Australian employers"
              className="inline-flex items-center gap-1.5 rounded-pill border border-attention/30 bg-attention-soft px-2.5 py-1 text-xs font-semibold text-attention shadow-xs transition-colors hover:bg-attention/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AlertCircleIcon className="h-3 w-3" strokeWidth={2} />
              <span>Fit to one page</span>
            </button>
          )}
        </div>

        <Row label="Accent color">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Default (template's own color)"
              aria-pressed={accentColor === null}
              title="Default"
              onClick={() => onSelectAccentColor(null)}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform ${focusRing} ${
                accentColor === null ? "scale-110 border-ink text-ink" : "border-border text-ink-muted hover:scale-105"
              }`}
            >
              ×
            </button>
            {ACCENT_SWATCHES.map((accent) => (
              <button
                key={accent.id}
                type="button"
                aria-label={accent.name}
                aria-pressed={accentColor === accent.hex}
                title={accent.name}
                onClick={() => onSelectAccentColor(accent.hex)}
                className={`h-6 w-6 shrink-0 rounded-full border-2 transition-transform ${focusRing} ${
                  accentColor === accent.hex ? "scale-110 border-ink" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: accent.hex }}
              />
            ))}
          </div>
        </Row>

        <Row label="Margins">
          <PresetSegmented presets={MARGIN_PRESETS} value={marginPreset} onChange={onSelectMarginPreset} ariaLabel="Page margins" />
        </Row>

        <Row label="Spacing">
          <PresetSegmented presets={SPACING_PRESETS} value={spacingPreset} onChange={onSelectSpacingPreset} ariaLabel="Section and bullet spacing" />
        </Row>

        <Row label="Line height">
          <PresetSegmented presets={LINE_HEIGHT_PRESETS} value={lineHeightPreset} onChange={onSelectLineHeightPreset} ariaLabel="Line height" />
        </Row>

        <p className="text-[11px] leading-relaxed text-ink-muted">
          Compact/spacious picks are a starting point - if your resume doesn&apos;t fit the page, it&apos;s automatically tightened back down the same way it already is today.
        </p>
      </div>
    </aside>
  );
}
