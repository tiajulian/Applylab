import { factCheckTargetKey, type FactCheckTarget, type ResumeContent, type ResumeReviewFinding } from "@/types";
import { listBlocks, setBlockText } from "@/lib/review/blocks";

export type ReviewAction = "apply" | "dismiss" | "undo";
export type ActionableFinding = ResumeReviewFinding & {
  review_change?: { blockId: string; before: string; after: string };
};

/** Only a unique, writable field can be changed. Never guess between identical bullets. */
export function findingField(content: ResumeContent, finding: ResumeReviewFinding) {
  const blocks = listBlocks(content);
  if (finding.target) {
    const block = blocks.find((b) => b.id === factCheckTargetKey(finding.target!));
    if (!block?.writable) return null;
    if (finding.bullet_text && block.text.trim() !== finding.bullet_text.trim()) return null;
    return block;
  }
  if (!finding.bullet_text?.trim()) return null;
  const matches = blocks.filter((b) => /^(experienceBullet|projectBullet):/.test(b.id) && b.text.trim() === finding.bullet_text!.trim());
  return matches.length === 1 ? matches[0] : null;
}

/** Advice ("Add your employer's name") must never be inserted as resume text. */
export function suggestedReplacement(finding: ResumeReviewFinding): string | null {
  if (finding.replacement) return finding.replacement;
  return finding.id.startsWith("claude-finding-") && finding.bullet_text && finding.fix_text
    ? finding.fix_text
    : null;
}

export function targetForBlock(blockId: string): FactCheckTarget | undefined {
  const [kind, index, field] = blockId.split(":");
  if (kind === "summary") return { kind };
  if (kind === "experienceBullet" || kind === "projectBullet") return { kind, index: Number(index), bulletIndex: Number(field) };
  if (kind === "customItem") return { kind, index: Number(index), bulletIndex: Number(field) };
  return undefined;
}

export function undoReviewChange(content: ResumeContent, finding: ActionableFinding): ResumeContent | null {
  const change = finding.review_change;
  if (!change) return null;
  const block = listBlocks(content).find((b) => b.id === change.blockId && b.writable);
  if (!block || block.text !== change.after) return null;
  return setBlockText(content, block.id, change.before);
}

export function blankQuestion(blank: string): string {
  const detail = blank.slice(1, -1).replace(/^add\s+|^insert\s+|^specify\s+/i, "").trim();
  if (/tool|system|platform/i.test(detail)) return "Which tool or system did you use?";
  if (/team|stakeholder|audience/i.test(detail)) return "Who did you do this work for or with?";
  if (/result|outcome|impact/i.test(detail)) return "What was the result? A number is optional.";
  return `What should replace ${blank}?`;
}
