"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fillInPlaceholders, hasFillInPlaceholder } from "@/lib/resume/placeholders";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import { LockIcon, CheckIcon } from "./icons";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
import type { ResumeReviewFinding } from "@/types";

interface FindingsPanelProps {
  findings: ResumeReviewFinding[];
  unlocked: boolean;
  /** fixText: the suggestion with its [blanks] filled in, when it had any. */
  onApplyFix: (finding: ResumeReviewFinding, fixText?: string) => Promise<void>;
  applyingFindingId: string | null;
}

const SEVERITY_ORDER: Record<ResumeReviewFinding["severity"], number> = {
  hard_fail: 0,
  warning: 1,
  info: 2,
};

/** Still needs doing: same rule the scorer uses for each category's finding_count. */
export function isOpenFinding(finding: ResumeReviewFinding) {
  return finding.status !== "applied" && finding.status !== "dismissed";
}

/** Findings as a short to-do list: "Fix first" (high priority + warnings), then "Nice to have". */
export function FindingsPanel({ findings: allFindings, unlocked, onApplyFix, applyingFindingId }: FindingsPanelProps) {
  const router = useRouter();

  const findings = allFindings.filter((f) => f.status !== "dismissed");
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const groups = [
    { title: "Fix first", items: sorted.filter((f) => f.severity !== "info") },
    { title: "Nice to have", items: sorted.filter((f) => f.severity === "info") },
  ].filter((g) => g.items.length > 0);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="findings-heading">
      <h2 id="findings-heading" className="font-display text-h3 font-semibold text-ink">
        What to improve
      </h2>

      {findings.length === 0 && (
        <Card className="p-6 text-center text-sm text-ink-secondary">
          No specific suggestions this time.
        </Card>
      )}

      {!unlocked && findings.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <LockIcon className="h-4 w-4 flex-shrink-0 text-accent" />
            See why each one matters, with rewrites you can apply in one click.
          </p>
          <Button type="button" size="sm" onClick={() => router.push("/upgrade")} className="whitespace-nowrap">
            Unlock fixes
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {group.title} · {group.items.filter(isOpenFinding).length}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {group.items.map((finding) => (
              <FindingItem
                key={finding.id}
                finding={finding}
                unlocked={unlocked}
                isApplying={applyingFindingId === finding.id}
                onApplyFix={onApplyFix}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function FindingItem({
  finding,
  unlocked,
  isApplying,
  onApplyFix,
}: {
  finding: ResumeReviewFinding;
  unlocked: boolean;
  isApplying: boolean;
  onApplyFix: (finding: ResumeReviewFinding, fixText?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const isApplied = finding.status === "applied";
  const expandable = unlocked && !isApplied && Boolean(finding.detail || finding.fix_text);
  const bodyId = `finding-body-${finding.id}`;
  const meta = [finding.resume_location, REVIEW_CATEGORIES[finding.category_key].label]
    .filter(Boolean)
    .join(" · ");

  const header = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-sm font-semibold ${isApplied ? "text-ink-muted line-through" : "text-ink"}`}>
          {finding.title}
        </span>
        <span className="text-xs text-ink-muted">{meta}</span>
      </span>
      {isApplied && (
        <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-success">
          <CheckIcon className="h-3 w-3" />
          Fixed
        </span>
      )}
      {expandable && (
        <ChevronDownIcon
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-fast ${open ? "rotate-180" : ""}`}
        />
      )}
    </>
  );

  return (
    <li className="flex flex-col">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-start gap-3 p-4 text-left transition-colors duration-fast hover:bg-paper-deep/40"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start gap-3 p-4">{header}</div>
      )}

      {/* Kept mounted while collapsed so a half-filled rewrite survives closing the item. */}
      {expandable && (
        <div id={bodyId} className={`${open ? "flex" : "hidden"} flex-col gap-2.5 px-4 pb-4`}>
          {finding.detail && <p className="text-sm leading-relaxed text-ink-secondary">{finding.detail}</p>}

          {finding.fix_text &&
            (hasFillInPlaceholder(finding.fix_text) ? (
              <FillInBlanks finding={finding} isApplying={isApplying} onApply={onApplyFix} />
            ) : (
              <>
                <div className="rounded-lg bg-paper-deep/60 p-3">
                  <span className="text-xs font-medium text-ink-muted">Suggested rewrite</span>
                  <p className="mt-1 text-sm text-ink">{finding.fix_text}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isApplying}
                    onClick={() => onApplyFix(finding)}
                  >
                    Apply fix
                  </Button>
                </div>
              </>
            ))}
        </div>
      )}
    </li>
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
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-ink-secondary" htmlFor={`fill-${finding.id}`}>
        Suggested rewrite: replace the [blanks] with your real figures, or delete them
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
        >
          Apply fix
        </Button>
      </div>
    </div>
  );
}
