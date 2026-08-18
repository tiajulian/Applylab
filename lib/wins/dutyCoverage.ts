/**
 * Shared, deterministic slot-coverage check - zero API, pure structure. Reports which Win Builder
 * slots (see components/profile/WinBuilder.tsx) a piece of evidence already carries, and whether
 * it's "thin": task stated, but no proof of impact. Thin is defined narrowly as missing BOTH proof
 * slots (outcome and metric) - tools/stakeholders are secondary signal only, never enough on their
 * own to call something thin. This is a coverage report, not a quality critique: it never reads or
 * judges the wording, only whether the slots are empty.
 *
 * Generic input shape (not typed to RoleDutyItem) so the resume-level highlighter (a separate,
 * not-yet-built feature) can run the same check against a generated bullet's evidence pool.
 */
export interface CoverageSlots {
  outcome?: string | null;
  metric?: string | null;
  tools?: string[] | null;
  stakeholders?: string[] | null;
}

export interface CoverageResult {
  hasOutcome: boolean;
  hasMetric: boolean;
  hasTools: boolean;
  hasStakeholders: boolean;
  isThin: boolean;
}

export function checkSlotCoverage(slots: CoverageSlots): CoverageResult {
  const hasOutcome = Boolean(slots.outcome?.trim());
  const hasMetric = Boolean(slots.metric?.trim());
  const hasTools = Boolean(slots.tools && slots.tools.length > 0);
  const hasStakeholders = Boolean(slots.stakeholders && slots.stakeholders.length > 0);

  return {
    hasOutcome,
    hasMetric,
    hasTools,
    hasStakeholders,
    isThin: !hasOutcome && !hasMetric,
  };
}
