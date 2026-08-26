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
    return <p className="text-xs text-ink-muted">{QUOTA_COPY.remaining(remaining, limit)}.</p>;
  }

  return (
    <p className="text-xs font-medium text-attention">
      {QUOTA_COPY.exhausted(limit)}{" "}
      <Link href="/upgrade" className="underline hover:text-attention/80">
        Upgrade for unlimited.
      </Link>
    </p>
  );
}
