import { Card } from "@/components/ui/Card";
import { reviewStrengths, topReviewFindings } from "@/lib/resume/reviewHighlights";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

export function ReviewHighlights({ content, findings, unlocked, onSelect }: {
  content: ResumeContent;
  findings: ResumeReviewFinding[];
  unlocked: boolean;
  onSelect: (findingId: string) => void;
}) {
  const top = topReviewFindings(findings);
  const strengths = reviewStrengths(content);
  return (
    <Card density="content" className="border border-border bg-surface shadow-sm">
      <h2 className="text-h3 font-semibold text-ink">Start here</h2>
      <p className="mt-1 text-sm text-ink-secondary">{top.length ? "Work through these suggestions first. You can find the full list below." : "No open suggestions in this review. Check again after making edits for an updated result."}</p>
      {top.length > 0 && (
        <ol className="mt-3 divide-y divide-border">
          {top.map((finding, index) => (
            <li key={finding.id} className="flex items-start gap-3">
              <span className="pt-3 text-sm tabular-nums text-ink-muted" aria-hidden="true">{index + 1}.</span>
              {unlocked ? (
                <button type="button" onClick={() => onSelect(finding.id)} className="min-h-11 min-w-0 flex-1 rounded-sm py-3 text-left text-sm font-medium text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span className="block break-words">{finding.title}</span>
                  {finding.resume_location && <span className="mt-0.5 block text-xs font-normal text-ink-secondary">{finding.resume_location}</span>}
                </button>
              ) : <span className="py-3 text-sm text-ink">{finding.title}</span>}
            </li>
          ))}
        </ol>
      )}
      {strengths.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-ink">What&apos;s already in place</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-secondary">{strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}
