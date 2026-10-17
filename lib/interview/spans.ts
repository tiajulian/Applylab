import { STAR_PARTS } from "@/lib/interview/scoreLabels";
import type { StarPart, TranscriptSpan } from "@/types";

/**
 * The scorer quotes the words where each STAR part happened rather than giving character
 * offsets (models are bad at counting characters). This finds each quote in the transcript and
 * turns it into offsets, dropping quotes it can't find and any that overlap an earlier one.
 */
export function quotesToSpans(transcript: string, quotes: unknown): TranscriptSpan[] {
  if (!Array.isArray(quotes) || !transcript) return [];
  const lower = transcript.toLowerCase();
  const spans: TranscriptSpan[] = [];

  for (const q of quotes) {
    const part = String(q?.part ?? "").toLowerCase() as StarPart;
    const quote = String(q?.quote ?? "").trim().toLowerCase();
    if (!STAR_PARTS.includes(part as (typeof STAR_PARTS)[number]) || quote.length < 3) continue;
    const start = lower.indexOf(quote);
    if (start < 0) continue;
    const span = { start, end: start + quote.length, part };
    if (spans.some((s) => span.start < s.end && s.start < span.end)) continue;
    spans.push(span);
  }

  return spans.sort((a, b) => a.start - b.start);
}

/** Server-stored spans, re-validated before rendering (bounds, order, no overlap). */
export function safeSpans(transcript: string, spans: TranscriptSpan[] | null | undefined): TranscriptSpan[] {
  if (!spans?.length) return [];
  const out: TranscriptSpan[] = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < 0 || s.end > transcript.length || s.end <= s.start) continue;
    if (out.length && s.start < out[out.length - 1].end) continue;
    out.push(s);
  }
  return out;
}

export const FILLER_WORDS = ["um", "uh", "erm", "like", "basically", "actually", "literally", "you know", "kind of", "sort of"];

const STOP_WORDS = new Set(
  "the a an and or but so to of in on at for with i we it was is be that this my our they them their you as by from had have has were are me us he she his her its not just then there what when which who".split(" ")
);

/** Content words said 3+ times, most repeated first ("You said 'basically' 5 times."). */
export function repeatedWords(transcript: string, min = 3): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of transcript.toLowerCase().match(/[\p{L}']+/gu) ?? []) {
    if (w.length < 4 || STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));
}

/** Most-used filler words in a transcript. */
export function topFillers(transcript: string, limit = 3): { word: string; count: number }[] {
  const lower = transcript.toLowerCase();
  return FILLER_WORDS.map((word) => ({
    word,
    count: (lower.match(new RegExp(`(?<![\\p{L}'])${word}(?![\\p{L}'])`, "gu")) ?? []).length,
  }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
