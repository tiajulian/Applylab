import Link from "next/link";
import { QUOTA_COPY } from "@/lib/copy";

export function QuotaIndicator({
  isFreePlan,
  remaining,
  limit,
}: {
  isFreePlan: boolean;
  remaining: number;
  limit: number;
}) {
  if (!isFreePlan) return null;

  if (remaining > 0) {
    return <p className="text-[13px] text-ink-muted">{QUOTA_COPY.remaining(remaining, limit)}.</p>;
  }

  return (
    <p className="text-[13.5px] text-ink-secondary">
      {QUOTA_COPY.exhausted(limit)}{" "}
      <Link href="/upgrade" className="font-semibold text-accent-hover underline underline-offset-4">
        Go Pro for unlimited resumes.
      </Link>
    </p>
  );
}
