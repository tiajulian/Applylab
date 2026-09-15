"use client";

import { MODERN_CURATED_ACCENTS } from "@/lib/resume/templateMetadata";

/** Accent customisation only applies to the Modern template today (the only one whose tokens
 * expose a swappable accent) - matches ChooseTemplateModal's existing behaviour, just surfaced
 * inline in the toolbar instead of requiring the template picker modal to be open. */
export function AccentColorToggle({
  isModernTemplate,
  accentColor,
  onSelect,
}: {
  isModernTemplate: boolean;
  accentColor: string | null;
  onSelect: (accentColor: string) => void;
}) {
  if (!isModernTemplate) return null;

  const current = accentColor ?? MODERN_CURATED_ACCENTS[0].hex;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-ink-secondary">Colour</span>
      <div className="flex items-center gap-1">
        {MODERN_CURATED_ACCENTS.map((accent) => (
          <button
            key={accent.id}
            type="button"
            aria-label={accent.name}
            aria-pressed={current === accent.hex}
            title={accent.name}
            onClick={() => onSelect(accent.hex)}
            className={`h-5 w-5 shrink-0 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              current === accent.hex ? "scale-110 border-ink" : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: accent.hex }}
          />
        ))}
      </div>
    </div>
  );
}
