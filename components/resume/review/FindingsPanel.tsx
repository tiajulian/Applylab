"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { ResumeReviewCategoryKey, ResumeReviewFinding } from "@/types";

interface FindingsPanelProps {
  findings: ResumeReviewFinding[];
  unlocked: boolean;
  selectedCategory: ResumeReviewCategoryKey | "all";
  onSelectCategory: (category: ResumeReviewCategoryKey | "all") => void;
  onApplyFix: (finding: ResumeReviewFinding) => Promise<void>;
  applyingFindingId: string | null;
}

const CATEGORY_LABELS: Record<ResumeReviewCategoryKey, string> = {
  ats_structure: "ATS & structure",
  content_quality: "Content quality",
  writing_quality: "Writing quality",
  job_optimization: "Job optimization",
  application_readiness: "Application readiness",
};

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

  const categoriesWithFindings: Array<{ key: ResumeReviewCategoryKey | "all"; label: string; count: number }> = [
    { key: "all", label: "All findings", count: findings.length },
    { key: "ats_structure", label: "ATS & structure", count: findings.filter((f) => f.category_key === "ats_structure").length },
    { key: "content_quality", label: "Content quality", count: findings.filter((f) => f.category_key === "content_quality").length },
    { key: "writing_quality", label: "Writing quality", count: findings.filter((f) => f.category_key === "writing_quality").length },
    { key: "job_optimization", label: "Job optimization", count: findings.filter((f) => f.category_key === "job_optimization").length },
    { key: "application_readiness", label: "Application readiness", count: findings.filter((f) => f.category_key === "application_readiness").length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-h3 font-semibold text-ink">
              What the panel found
            </h2>
            <p className="text-xs text-ink-muted">
              {findings.length} total diagnostic {findings.length === 1 ? "finding" : "findings"} across 5 categories
            </p>
          </div>

          {!unlocked && (
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/upgrade")}
              className="shadow-sm"
            >
              Unlock reasoning &amp; fixes (Pro)
            </Button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {categoriesWithFindings.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => onSelectCategory(cat.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-fast ${
                selectedCategory === cat.key
                  ? "bg-ink text-paper shadow-sm"
                  : "bg-surface text-ink-secondary hover:bg-paper-deep border border-border"
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  selectedCategory === cat.key ? "bg-paper/20 text-paper" : "bg-paper-deep text-ink-muted"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

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
                          {CATEGORY_LABELS[finding.category_key]}
                        </span>
                        {finding.resume_location && (
                          <span className="text-xs text-ink-muted">
                            • {finding.resume_location}
                          </span>
                        )}
                        {isApplied && (
                          <Badge variant="neutral" className="bg-success-soft text-success text-[10px]">
                            Applied ✓
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-ink">
                        {finding.title}
                      </h4>
                    </div>
                  </div>

                  {unlocked ? (
                    // Unlocked Pro/Lifetime View
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

                      {finding.fix_text && (
                        <div className="flex items-center justify-end pt-1">
                          {isApplied ? (
                            <span className="text-xs font-medium text-success">
                              Fix applied to resume ✓
                            </span>
                          ) : (
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
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Paywalled Free View
                    <div className="relative mt-3 overflow-hidden rounded-lg border border-border/60 bg-paper-deep/40 p-4">
                      {/* Blurred placeholder text representing paywalled insight */}
                      <div className="select-none blur-[5px] filter opacity-50 space-y-1.5" aria-hidden="true">
                        <div className="h-3.5 w-full rounded bg-ink-muted/30" />
                        <div className="h-3.5 w-5/6 rounded bg-ink-muted/30" />
                        <div className="mt-2 h-7 w-3/4 rounded bg-accent/30" />
                      </div>

                      {/* Paywall CTA Card overlay */}
                      <div className="absolute inset-0 flex items-center justify-between gap-3 bg-surface/80 p-4 backdrop-blur-[2px]">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                          <span className="text-xs font-medium text-ink">
                            Detailed reasoning and 1-click fixes are locked.
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => router.push("/upgrade")}
                          className="text-xs whitespace-nowrap shadow-sm"
                        >
                          Upgrade to unlock
                        </Button>
                      </div>
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
