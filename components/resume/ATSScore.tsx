import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

function scoreTone(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: "text-success", bg: "bg-success-soft" };
  if (score >= 50) return { text: "text-attention", bg: "bg-attention-soft" };
  return { text: "text-critical", bg: "bg-critical-soft" };
}

export function ATSScore({
  score,
  missingKeywords,
}: {
  score: number;
  missingKeywords: string[];
}) {
  const tone = scoreTone(score);

  return (
    <Reveal>
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-pill px-3 py-1 text-lg font-semibold ${tone.bg} ${tone.text}`}>
            <CountUp value={score} />
          </span>
          <span className="text-sm text-ink-secondary">ATS match score</span>
        </div>
        <ProgressBar value={score} className="mt-3" />
        {missingKeywords.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Missing keywords
            </p>
            <StaggerList className="mt-2 flex flex-wrap gap-2">
              {missingKeywords.map((keyword) => (
                <StaggerItem key={keyword} className="inline-flex">
                  <Badge variant="neutral" className="font-mono">
                    {keyword}
                  </Badge>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        )}
      </Card>
    </Reveal>
  );
}
