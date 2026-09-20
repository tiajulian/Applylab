export type ReviewKind = "change" | "fix";
export type ReviewSeverity = "info" | "warn" | "verify";
export type ReviewProvenance = "profile" | "reworded" | "new_claim";
export type ReviewStatus = "open" | "accepted" | "dismissed" | "resolved";

export const MAX_REASON_LENGTH = 120;
export const MAX_LISTED_ITEMS = 200;

export interface ReviewItem {
  /** Stable while the same rule keeps hitting the same text (see assignIds in engine.ts). */
  id: string;
  resumeId: string;
  kind: ReviewKind;
  ruleId: string;
  severity: ReviewSeverity;
  /** A factCheckTargetKey-style block id ("summary", "experienceBullet:0:1"), also the
   * data-fc-target the preview renders that block under. */
  blockId: string;
  /** [start, end) in the block's text. */
  start: number;
  end: number;
  before: string;
  after: string;
  reason: string;
  /** Changes only. */
  provenance?: ReviewProvenance;
  /** The claims (numbers, tools) the AI added that the profile does not back up. new_claim only. */
  claims?: string[];
  status: ReviewStatus;
}

/** What a rule emits: everything but the identity and lifecycle fields the engine owns. `key` is what
 * makes the item "the same one" across re-analysis (defaults to `before`, the matched text). */
export type RawReviewItem = Omit<ReviewItem, "id" | "resumeId" | "status"> & { key?: string };

/** One highlighted passage: overlapping items in a block merged into a single range. */
export interface ReviewPassage {
  blockId: string;
  start: number;
  end: number;
  severity: Exclude<ReviewSeverity, "info">;
  itemIds: string[];
}

export function clampReason(reason: string): string {
  return reason.length <= MAX_REASON_LENGTH ? reason : `${reason.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`;
}
