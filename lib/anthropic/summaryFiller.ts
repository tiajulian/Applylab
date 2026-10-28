import { callGateway, gemini, geminiOutputTokens } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { protectedSpans, SUMMARY_FILLER } from "@/lib/text/jobAdFiller";
import type { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

// Its own feature name: never "assist" (the hourly polish caps count those rows, and generating a
// resume must not use them up), and never the parent generation's name (that would double the
// admin dashboard's per-resume call counts).
const FEATURE = "summary-cleanup" as const;
// Same small, fast model as the other single-text rewrites (assistBullet.ts).
const PROVIDER = MODEL_BY_FEATURE.assist.provider;
const MODEL = MODEL_BY_FEATURE.assist.model;

const TIMEOUT_MS = 8_000;

/**
 * The filler phrases in `text`, as written there. An occurrence that sits inside one of the
 * candidate's own `protectedTerms` is their fact, not filler; another occurrence of the same phrase
 * elsewhere still counts.
 */
export function findSummaryFiller(text: string, protectedTerms: string[] = []): string[] {
  const spans = protectedSpans(text.toLowerCase(), protectedTerms);
  const found: string[] = [];
  for (const re of SUMMARY_FILLER) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!spans.some(([s, e]) => s <= start && end <= e)) found.push(m[0]);
    }
  }
  return found;
}

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

/**
 * Sentence ends: terminal punctuation then whitespace, but not after "e.g.", "i.e.", "etc.", "vs."
 * or a dotted abbreviation like "U.S.", and never inside "2.5" or "Node.js" (no whitespace there).
 */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])(?<!\b(?:e\.g|i\.e|etc|vs)\.)(?<!\b[A-Za-z]\.[A-Za-z]\.)\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deterministic fallback: drop the later sentences carrying filler. The first sentence is the
 * candidate's identity line (role, years, tools) and is always kept - a stray filler word there
 * costs less than losing those facts.
 */
export function dropFillerSentences(summary: string, protectedTerms: string[] = []): string {
  const [first, ...rest] = sentencesOf(summary);
  if (!first) return summary;
  return [first, ...rest.filter((s) => findSummaryFiller(s, protectedTerms).length === 0)].join(" ");
}

// Small connecting words a deletion-style edit may need; anything else must come from the original.
const CONNECTORS = new Set(
  "a an and the of in on at for to with across by as or but who which that this these their its is are was were has have had into from".split(" ")
);

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9.+#'-]*/g)?.map((w) => w.replace(/[.,']+$/, "")) ?? [];
}

/** Capitalised words other than each sentence's first word: names, tools, places. */
function properWords(text: string): string[] {
  return sentencesOf(text).flatMap((s) =>
    (s.match(/[\w.+#-]+/g) ?? [])
      .slice(1)
      .filter((w) => /[A-Z]/.test(w))
      .map((w) => w.replace(/[.,]+$/, ""))
  );
}

/**
 * A rewrite is only usable if it removed the filler, added nothing, and lost no facts:
 * - every word already in the original (or a small connector), no preamble, not much longer;
 * - every number and every named tool/place from the original still present;
 * - not cut to under half the original length.
 * Strict on purpose - an unusable rewrite just falls back to dropFillerSentences.
 */
export function isCleanRewrite(original: string, rewrite: string, protectedTerms: string[] = []): boolean {
  const r = rewrite.trim();
  if (!r || findSummaryFiller(r, protectedTerms).length > 0) return false;
  if (r.length > original.length * 1.2 || r.length < original.length * 0.5) return false;
  if (/^(here|sure|edited|summary)\b/i.test(r)) return false;

  const originalWords = new Set(wordsOf(original));
  if (!wordsOf(r).every((w) => originalWords.has(w) || CONNECTORS.has(w))) return false;

  const rewriteNumbers = new Set(numbersIn(r));
  const originalNumbers = numbersIn(original);
  if (originalNumbers.some((n) => !rewriteNumbers.has(n))) return false;
  if (numbersIn(r).some((n) => !originalNumbers.includes(n))) return false;

  const rewriteLower = r.toLowerCase();
  return properWords(original).every((w) => rewriteLower.includes(w.toLowerCase()));
}

const SYSTEM_PROMPT = `
You edit one resume summary. Remove the listed filler phrases and any claim of a benefit or result
the summary doesn't back with a fact. Mostly delete; when a sentence needs repairing, reuse the
summary's own words. Keep every real fact: role, skills, tools, domains, years. Add nothing new: no
tool, skill, number, domain, outcome, or audience. Australian English. Never use em dashes. Return
only the edited summary as plain text.
`;

/**
 * Backstop for the summary's job-ad filler: one short AI rewrite when filler is found, falling back
 * to dropping the offending sentences if the call fails, times out, or its result is unusable.
 * Returns the summary unchanged, with no AI call, when it has no filler.
 */
export async function cleanSummaryFiller(
  summary: string,
  options: { userId: string; supabase: SupabaseServerClient; tier: Plan; protectedTerms?: string[] }
): Promise<string> {
  const { userId, supabase, tier, protectedTerms = [] } = options;
  const filler = findSummaryFiller(summary, protectedTerms);
  if (filler.length === 0) return summary;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = callGateway({
      supabase,
      userId,
      tier,
      feature: FEATURE,
      provider: PROVIDER,
      model: MODEL,
      estimatedCredits: 8,
      shadow: true,
      // Part of resume generation, which is itself exempt ("core journey, never refused").
      exemptFromQuota: true,
      invoke: () =>
        gemini.models.generateContent({
          model: MODEL,
          contents: `Filler to remove: ${filler.map((f) => `"${f}"`).join(", ")}\n\nSummary:\n${summary}`,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.2,
            maxOutputTokens: 512,
            thinkingConfig: { thinkingBudget: 1 },
          },
        }),
      extractUsage: (result) => ({
        inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: geminiOutputTokens(result.usageMetadata),
      }),
    }).then(async (response) => {
      // Logged even when it lands after the timeout, so a billed call is never missing from the log.
      await logApiCost({
        userId,
        feature: FEATURE,
        provider: PROVIDER,
        model: MODEL,
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: geminiOutputTokens(response.usageMetadata),
      });
      return response;
    });
    // A late failure after the timeout has nobody waiting on it: swallow it rather than leave it unhandled.
    call.catch(() => {});

    // A slow clean-up must not hold up resume generation: past the timeout, use the fallback.
    const response = await Promise.race([
      call,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("summary clean-up timed out")), TIMEOUT_MS);
      }),
    ]);

    const rewrite = sanitizeDashes((response.text ?? "").trim());
    if (isCleanRewrite(summary, rewrite, protectedTerms)) return rewrite;
  } catch {
    // Fall through: a failed clean-up must never fail resume generation.
  } finally {
    clearTimeout(timer);
  }
  return dropFillerSentences(summary, protectedTerms);
}
