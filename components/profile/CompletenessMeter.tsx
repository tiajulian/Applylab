import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";

export function CompletenessMeter({ completeness }: { completeness: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">Profile completeness</span>
        <span className="text-ink-secondary">
          <CountUp value={completeness} suffix="%" />
        </span>
      </div>
      <ProgressBar value={completeness} className="mt-2" />
    </Card>
  );
}
