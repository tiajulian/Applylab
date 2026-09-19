import { buildKnownWords } from "@/lib/text/spellcheck";
import type { FactCheckFlag, ResumeContent } from "@/types";
import { listBlocks, type ReviewBlock } from "./blocks";
import { reconcile } from "./engine";
import { provenanceItems, type ProfileSource } from "./provenance";
import { flagItems, integrityItems, spellingItems, styleItems, type RuleContext } from "./rules";
import type { RawReviewItem, ReviewItem } from "./types";

export interface AnalysisContext {
  checker: RuleContext["checker"];
  profile: ProfileSource | null;
  flags: FactCheckFlag[];
}

// Rules that look across the whole resume rather than at one block's own text; they re-run on every
// analysis and reconcile against all blocks, while block rules only re-run on blocks that changed.
const isGlobalRule = (ruleId: string) => ruleId.startsWith("integrity.") || ruleId.startsWith("factcheck.");

/** Text per block id: what a later run compares against to find the blocks that changed. */
export function snapshotBlocks(blocks: ReviewBlock[]): Map<string, string> {
  return new Map(blocks.map((b) => [b.id, b.text]));
}

/**
 * One analysis pass. `previous` is the block text at the last pass (null on the first pass or after
 * a context change such as new profile/flags: everything is re-analysed). Only blocks whose text
 * differs are re-run through the block rules; blocks that vanished count as analysed so their open
 * items resolve.
 */
export function analyzeResume(args: {
  resumeId: string;
  content: ResumeContent;
  prev: ReviewItem[];
  previous: ReadonlyMap<string, string> | null;
  ctx: AnalysisContext;
  dismissed: ReadonlySet<string>;
  kept: ReadonlySet<string>;
}): ReviewItem[] {
  const { resumeId, content, prev, previous, ctx, dismissed, kept } = args;
  const blocks = listBlocks(content);
  const current = snapshotBlocks(blocks);
  const changed = new Set<string>();
  for (const [id, text] of current) if (!previous || previous.get(id) !== text) changed.add(id);
  if (previous) for (const id of previous.keys()) if (!current.has(id)) changed.add(id);

  // Rules that read other parts of the resume (tools, skills, employers) can change any bullet's result.
  const vocabChanged = previous && blocks.some((b) => /^(skill|tool|experienceHeader:\d+:company)/.test(b.id) && changed.has(b.id));
  const rescanAll = !previous || vocabChanged;

  const ruleCtx: RuleContext = { checker: ctx.checker, knownWords: buildKnownWords(content) };
  const localRaw: RawReviewItem[] = [];
  const scope = new Set<string>();
  for (const block of blocks) {
    if (!rescanAll && !changed.has(block.id)) continue;
    scope.add(block.id);
    localRaw.push(...spellingItems(block, ruleCtx), ...styleItems(block), ...provenanceItems(block, content, ctx.profile));
  }
  if (previous) for (const id of previous.keys()) if (!current.has(id)) scope.add(id);
  if (rescanAll) for (const item of prev) scope.add(item.blockId);

  const local = reconcile({
    resumeId, prev: prev.filter((i) => !isGlobalRule(i.ruleId)), raw: localRaw, analysedBlocks: scope, dismissed, kept,
  });

  // A bullet already carrying a provenance claim item does not get a second card from an old flag.
  const claimBlocks = new Set(local.filter((i) => i.ruleId === "provenance.new_claim" && i.status !== "resolved").map((i) => i.blockId));
  const globalRaw = [...integrityItems(content, blocks), ...flagItems(ctx.flags, blocks).filter((i) => !claimBlocks.has(i.blockId))];
  const global = reconcile({
    resumeId, prev: prev.filter((i) => isGlobalRule(i.ruleId)), raw: globalRaw,
    analysedBlocks: new Set([...current.keys(), ...(previous?.keys() ?? []), ...prev.map((i) => i.blockId)]), dismissed, kept,
  });

  const order = new Map(blocks.map((b, i) => [b.id, i]));
  return [...local, ...global].sort(
    (a, b) => (order.get(a.blockId) ?? 1e9) - (order.get(b.blockId) ?? 1e9) || a.start - b.start
  );
}
