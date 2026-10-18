"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fillInPlaceholders, hasFillInPlaceholder } from "@/lib/resume/placeholders";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import { LockIcon, CheckIcon } from "./icons";
import type { ResumeReviewCategoryKey, ResumeReviewFinding } from "@/types";

interface FindingsPanelProps {
  findings: ResumeReviewFinding[];
  unlocked: boolean;
  selectedCategory: ResumeReviewCategoryKey | "all";
  onSelectCategory: (category: ResumeReviewCategoryKey | "all") => void;
  /** fixText: the suggestion with its [blanks] filled in, when it had any. */
  onApplyFix: (finding: ResumeReviewFinding, fixText?: string) => Promise<void>;
  applyingFindingId: string | null;
}

const SEVERITY_CONFIG: Record<
  ResumeReviewFinding["severity"],
  { label: string; variant: "critical" | "attention" | "neutral" }
> = {
  hard_fail: { label: "High Priority", variant: "critical" },
  warning: { label: "Warning", variant: "attention" },
  info: { label: "Polish", variant: "neutral" },
};

export function FindingsPanel({
  findings,
  unlocked,
  selectedCategory,
  onSelectCategory,
  onApplyFix,
  applyingFindingId,
}: FindingsPanelProps) {
  const router = useRouter();

  const filteredFindings =
    selectedCategory === "all"
      ? findings
      : findings.filter((f) => f.category_key === selectedCategory);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h3 font-semibold text-ink">Findings &amp; fixes</h2>

        {selectedCategory !== "all" ? (
          <button
            type="button"
            onClick={() => onSelectCategory("all")}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-secondary transition-colors duration-fast hover:bg-paper-deep"
          >
            <span>Filtered: {REVIEW_CATEGORIES[selectedCategory].label}</span>
            <span className="text-ink-muted">· Clear</span>
          </button>
        ) : (
          <span className="text-xs text-ink-muted">
            {findings.length} {findings.length === 1 ? "finding" : "findings"}
          </span>
        )}
      </div>

      {/* Single, consolidated paywall banner replaces a per-card CTA */}
      {!unlocked && findings.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent-soft/30 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <LockIcon className="h-4 w-4" />
            </span>
            <span className="text-sm text-ink">
              Detailed reasoning and 1-click fixes for all {findings.length} findings are locked on the Free plan.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => router.push("/upgrade")}
            className="whitespace-nowrap shadow-sm"
          >
            Upgrade to unlock
          </Button>
        </Card>
      )}

      {filteredFindings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 text-center text-ink-muted">
          <p className="text-sm">No issues found in this category.</p>
        </Card>
      ) : (
        <StaggerList className="flex flex-col gap-3">
          {filteredFindings.map((finding) => {
            const severity = SEVERITY_CONFIG[finding.severity];
            const isApplying = applyingFindingId === finding.id;
            const isApplied = finding.status === "applied";

            return (
              <StaggerItem key={finding.id}>
                <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-fast">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severity.variant} className="text-[10px] uppercase tracking-wider">
                          {severity.label}
                        </Badge>
                        <span className="text-xs font-medium text-ink-muted">
                          {REVIEW_CATEGORIES[finding.category_key].label}
                        </span>
                        {finding.resume_location && (
                          <span className="text-xs text-ink-muted">
                            • {finding.resume_location}
                          </span>
                        )}
                        {isApplied && (
                          <Badge
                            variant="neutral"
                            className="flex items-center gap-1 bg-success-soft text-success text-[10px]"
                          >
                            <CheckIcon className="h-2.5 w-2.5" />
                            Applied
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-ink">
                        {finding.title}
                      </h4>
                    </div>
                  </div>

                  {unlocked ? (
                    // Unlocked Pro View
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3">
                      {finding.detail && (
                        <p className="text-sm leading-relaxed text-ink-secondary">
                          {finding.detail}
                        </p>
                      )}

                      {finding.fix_text && (
                        <div className="rounded-lg border border-accent/20 bg-accent-soft/30 p-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                            Suggested Rewrite / Action
                          </span>
                          <p className="mt-1 text-sm font-medium text-ink">
                            {finding.fix_text}
                          </p>
                        </div>
                      )}

                      {finding.fix_text &&
                        (isApplied ? (
                          <div className="flex items-center justify-end pt-1">
                            <span className="flex items-center gap-1 text-xs font-medium text-success">
                              <CheckIcon className="h-3 w-3" />
                              Fix applied to resume
                            </span>
                          </div>
                        ) : hasFillInPlaceholder(finding.fix_text) ? (
                          <FillInBlanks finding={finding} isApplying={isApplying} onApply={onApplyFix} />
                        ) : (
                          <div className="flex items-center justify-end pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              isLoading={isApplying}
                              onClick={() => onApplyFix(finding)}
                              className="text-xs"
                            >
                              Apply fix
                            </Button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    // Locked Free View — compact, no repeated blur block or CTA button per card
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-xs text-ink-muted">
                      <LockIcon className="h-3 w-3" />
                      <span>Reasoning &amp; fix locked</span>
                    </div>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}

/** A suggestion with "[X]" blanks: the candidate types their real figures in before it can be
 * applied, so a bracket never lands in the resume. */
function FillInBlanks({
  finding,
  isApplying,
  onApply,
}: {
  finding: ResumeReviewFinding;
  isApplying: boolean;
  onApply: (finding: ResumeReviewFinding, fixText?: string) => Promise<void>;
}) {
  const [text, setText] = useState(finding.fix_text ?? "");
  const blanks = fillInPlaceholders(text);
  return (
    <div className="flex flex-col gap-2 pt-1">
      <label className="text-xs font-medium text-ink-secondary" htmlFor={`fill-${finding.id}`}>
        Replace the [blanks] with your real figures, or delete them, then apply
      </label>
      <textarea
        id={`fill-${finding.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {blanks.length > 0 ? `${blanks.length} ${blanks.length === 1 ? "blank" : "blanks"} left` : "Ready to apply"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          isLoading={isApplying}
          disabled={blanks.length > 0 || !text.trim()}
          onClick={() => onApply(finding, text.trim())}
          className="text-xs"
        >
          Apply fix
        </Button>
      </div>
    </div>
  );
}
