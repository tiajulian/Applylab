import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { ContentScoreBreakdown, ContentScoreIssue, ResumeContent } from "@/types";

function scoreTone(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: "text-success", bg: "bg-success-soft" };
  if (score >= 50) return { text: "text-attention", bg: "bg-attention-soft" };
  return { text: "text-critical", bg: "bg-critical-soft" };
}

const SEVERITY_VARIANT: Record<ContentScoreIssue["severity"], "neutral" | "attention" | "critical"> = {
  low: "neutral",
  medium: "attention",
  high: "critical",
};

function findBulletLocation(
  resume: ResumeContent,
  bulletText: string
): { experienceIndex: number; bulletIndex: number } | null {
  for (let e = 0; e < resume.experience.length; e++) {
    const bulletIndex = resume.experience[e].bullets.indexOf(bulletText);
    if (bulletIndex !== -1) return { experienceIndex: e, bulletIndex };
  }
  return null;
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span className="capitalize">{label}</span>
        <span className="font-medium text-ink-secondary">{value}</span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}

export function ContentScorePanel({
  resume,
  onChange,
  score,
  breakdown,
  issues,
}: {
  resume: ResumeContent;
  onChange: (resume: ResumeContent) => void;
  score: number;
  breakdown: ContentScoreBreakdown;
  issues: ContentScoreIssue[];
}) {
  const tone = scoreTone(score);

  function applyFix(issue: ContentScoreIssue) {
    if (!issue.bulletText || !issue.suggestion) return;
    const location = findBulletLocation(resume, issue.bulletText);
    if (!location) return;

    const suggestion = issue.suggestion;
    onChange({
      ...resume,
      experience: resume.experience.map((entry, i) =>
        i === location.experienceIndex
          ? { ...entry, bullets: entry.bullets.map((b, j) => (j === location.bulletIndex ? suggestion : b)) }
          : entry
      ),
    });
  }

  return (
    <Reveal>
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-pill px-3 py-1 text-lg font-semibold ${tone.bg} ${tone.text}`}>
            <CountUp value={score} />
          </span>
          <span className="text-sm text-ink-secondary">Content quality score</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <BreakdownBar label="Impact" value={breakdown.impact} />
          <BreakdownBar label="Clarity" value={breakdown.clarity} />
          <BreakdownBar label="Brevity" value={breakdown.brevity} />
          <BreakdownBar label="Completeness" value={breakdown.completeness} />
        </div>

        {issues.length > 0 && (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Issues</p>
            <StaggerList className="flex flex-col gap-3">
              {issues.map((issue, index) => {
                const location = issue.bulletText ? findBulletLocation(resume, issue.bulletText) : null;
                const canApply = Boolean(issue.suggestion && issue.bulletText && location);

                return (
                  <StaggerItem key={index}>
                    <div className="rounded border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={SEVERITY_VARIANT[issue.severity]} className="uppercase">
                          {issue.severity}
                        </Badge>
                        <span className="text-xs text-ink-muted">{issue.location}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink-secondary">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="mt-1 text-sm italic text-ink-muted">Suggested: {issue.suggestion}</p>
                      )}
                      {issue.suggestion &&
                        (canApply ? (
                          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => applyFix(issue)}>
                            Apply fix
                          </Button>
                        ) : (
                          <p className="mt-2 text-xs text-ink-muted">This bullet has changed, so we can&apos;t auto-apply.</p>
                        ))}
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        )}
      </Card>
    </Reveal>
  );
}
