import { stripBulletPrefix } from "@/lib/text/cleanBullet";

/** Lowercase, bullet and punctuation stripped, spaces collapsed - so "…by 40%" and "• …by 40%."
 * compare as the same line. */
export function normalizeBullet(text: string): string {
  return stripBulletPrefix(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "their", "while", "across",
  "using", "via", "per", "over", "within", "our", "its", "was", "were", "has", "have",
]);

/** Content words with a crude suffix strip, so "enable"/"enabling" and "request"/"requests" match. */
function contentWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const word of normalizeBullet(text).split(" ")) {
    if (word.length < 3 && !/\d/.test(word)) continue;
    if (STOPWORDS.has(word)) continue;
    words.add(word.length > 5 ? word.replace(/(ing|ed|es|s|e)$/, "") : word);
  }
  return words;
}

/** Two lines that say mostly the same thing in different words. Overlap is measured against the
 * shorter line, so a reworded or extended copy of a bullet still counts. Short lines are never
 * flagged - too few words to tell a real repeat from a shared phrase. */
function areSimilarWordSets(wordsA: Set<string>, wordsB: Set<string>): boolean {
  const smaller = Math.min(wordsA.size, wordsB.size);
  if (smaller < 5) return false;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared++;
  return shared / smaller >= 0.7;
}

export type BulletFlag = { kind: "duplicate" | "similar"; of: number };

/**
 * Flags the weaker copy in each repeated pair - `of` is the index of the line it repeats. The line
 * kept is the one with a metric when only one has it, otherwise the earlier one. Exact repeats
 * (after normalizing) are always checked; reworded ones only when `includeSimilar` is set.
 */
export function findRepeatedBullets(
  items: { text: string; hasMetric: boolean }[],
  includeSimilar: boolean
): (BulletFlag | null)[] {
  const flags: (BulletFlag | null)[] = items.map(() => null);
  const normalized = items.map((item) => normalizeBullet(item.text));
  const words = includeSimilar ? items.map((item) => contentWords(item.text)) : [];

  for (let i = 0; i < items.length; i++) {
    if (!normalized[i] || flags[i]) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (flags[j] || !normalized[j]) continue;
      const kind =
        normalized[i] === normalized[j]
          ? "duplicate"
          : includeSimilar && areSimilarWordSets(words[i], words[j])
            ? "similar"
            : null;
      if (!kind) continue;
      if (items[j].hasMetric && !items[i].hasMetric) {
        flags[i] = { kind, of: j };
        // Lines already flagged as repeats of i now point at j, the line actually kept.
        for (let k = i + 1; k < j; k++) if (flags[k]?.of === i) flags[k] = { ...flags[k]!, of: j };
        break;
      }
      flags[j] = { kind, of: i };
    }
  }
  return flags;
}
