import type { GateResult } from "@/types";

/**
 * Prominent, always-visible flag for a resume the quality gate marked needs-review (see
 * lib/resume/qualityGate.ts) - shown as soon as the resume page loads, not only when the user
 * reaches the export-confirmation modal, so a hard-fail (an untraceable fact, missing wins, or a
 * summary duration claim the dates don't support) can't be missed by skipping straight to
 * download. Lists only the hard-fail checks; warnings/info stay in the export review flow.
 */
export function NeedsReviewBanner({ gateResult }: { gateResult: GateResult | null }) {
  if (!gateResult?.needsReview) return null;

  const failedHardChecks = gateResult.checks.filter((check) => check.severity === "hard_fail" && !check.passed);
  if (failedHardChecks.length === 0) return null;

  return (
    <div className="rounded border border-critical/30 bg-critical-soft p-4">
      <p className="font-medium text-critical">This resume needs review before you send it out</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm text-critical">
        {failedHardChecks.map((check) => (
          <li key={check.id}>
            <p className="font-medium">{check.label}</p>
            {check.details.map((detail, i) => (
              <p key={i} className="mt-0.5">{detail}</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
