import { Button } from "@/components/ui/Button";
import type { ContentScoreBreakdown, ContentScoreIssue, ResumeContent } from "@/types";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50";
  if (score >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

const SEVERITY_STYLES: Record<ContentScoreIssue["severity"], string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="capitalize">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} />
      </div>
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
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-lg font-semibold ${scoreColor(score)}`}>{score}</span>
        <span className="text-sm text-gray-600">Content quality score</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BreakdownBar label="Impact" value={breakdown.impact} />
        <BreakdownBar label="Clarity" value={breakdown.clarity} />
        <BreakdownBar label="Brevity" value={breakdown.brevity} />
        <BreakdownBar label="Completeness" value={breakdown.completeness} />
      </div>

      {issues.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Issues</p>
          {issues.map((issue, index) => {
            const location = issue.bulletText ? findBulletLocation(resume, issue.bulletText) : null;
            const canApply = Boolean(issue.suggestion && issue.bulletText && location);

            return (
              <div key={index} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="text-xs text-gray-500">{issue.location}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{issue.message}</p>
                {issue.suggestion && (
                  <p className="mt-1 text-sm italic text-gray-500">Suggested: {issue.suggestion}</p>
                )}
                {issue.suggestion &&
                  (canApply ? (
                    <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => applyFix(issue)}>
                      Apply fix
                    </Button>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">This bullet has changed, so we can&apos;t auto-apply.</p>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
