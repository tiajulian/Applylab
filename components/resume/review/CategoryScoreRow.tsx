"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import { LockIcon } from "./icons";
import type { ResumeReviewCategory } from "@/types";

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
  const description = REVIEW_CATEGORIES[category.key]?.description ?? "";

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
              <LockIcon className="h-3.5 w-3.5" />
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
