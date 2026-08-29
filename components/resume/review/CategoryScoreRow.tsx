"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import type { ResumeReviewCategory } from "@/types";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ats_structure: "Parseability, section formatting, and contact-field completeness",
  content_quality: "Bullet impact, concrete evidence, ownership, and metrics",
  writing_quality: "Active verbs, conciseness, tone, and cliché elimination",
  job_optimization: "Target title keywords and role requirement alignment",
  application_readiness: "Page budget, referee completeness, and link hygiene",
};

interface CategoryScoreRowProps {
  category: ResumeReviewCategory;
  onClick?: () => void;
  isSelected?: boolean;
}

export function CategoryScoreRow({
  category,
  onClick,
  isSelected = false,
}: CategoryScoreRowProps) {
  const percentage = Math.min(100, Math.round((category.score / category.max_points) * 100));
  const description = CATEGORY_DESCRIPTIONS[category.key] || "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-fast ease-editorial ${
        isSelected
          ? "border-accent/40 bg-accent-soft/30 shadow-sm"
          : "border-border bg-surface hover:border-border-strong hover:bg-paper-deep/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink group-hover:text-accent">
            {category.label}
          </span>
          {category.locked && (
            <span
              title="Findings and rewrites are locked on Free plan"
              aria-label="Findings locked"
              className="inline-flex items-center text-ink-muted group-hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-ink">
            {category.score}
          </span>
          <span className="text-ink-muted">
            / {category.max_points} pts
          </span>
        </div>
      </div>

      <p className="text-xs text-ink-muted line-clamp-1">
        {description}
      </p>

      <div className="mt-1">
        <ProgressBar value={percentage} />
      </div>
    </button>
  );
}
