import { createServiceRoleClient } from "@/lib/supabase/server";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { EMPTY_COMPACT_JOB_AD, MIN_JOB_AD_LENGTH, parseJobAd, type CompactJobAd } from "@/lib/anthropic/parseJobAd";

/**
 * Same sha256-of-text hash scheme used elsewhere (skills-bridge reuse, ats/content-score hash
 * caching) — see lib/resume/scoreCache.ts#hashForScoring. Exposed here so a caller that already
 * has the hash (e.g. to compare against a resume's own JD) doesn't need to re-derive it.
 */
export function hashJobAd(adText: string): string {
  return hashForScoring(adText);
}

function isEmptyResult(result: CompactJobAd): boolean {
  return (
    !result.title &&
    !result.company &&
    !result.seniority &&
    result.must_have_skills.length === 0 &&
    result.nice_to_have_skills.length === 0 &&
    result.tools.length === 0 &&
    result.key_responsibilities.length === 0 &&
    result.keywords.length === 0
  );
}

/**
 * Returns the compact structured facts for a job ad (see CompactJobAd), parsing it with Claude
 * only on a genuine cache miss. Keyed purely by a hash of the ad text and deliberately shared
 * across every user and every consumer (autofill, assist, ats-score, cover-letter, retailor) —
 * see the parsed_job_ads table comment in supabase/schema.sql for why that sharing is safe.
 *
 * Because the cache is shared across accounts, the write path here must stay strictly
 * extraction-only: never write anything beyond what parseJobAd derived from the ad's own text.
 * Nothing candidate-specific ever reaches this function or the table it writes to.
 *
 * A total extraction failure (every field empty — almost always a malformed/unparseable Claude
 * response rather than a genuinely content-free ad) is deliberately never cached, so a transient
 * failure can't permanently poison the shared cache for that ad.
 */
export async function getOrParseCompactJobAd(adText: string, userId: string): Promise<CompactJobAd> {
  // Nothing worth extracting (and nothing worth caching) from a near-empty ad - skip the Claude
  // call entirely rather than spending one on text that would just come back EMPTY_COMPACT_JOB_AD
  // anyway. Mirrors the same floor the New Resume form's autofill already applies client-side.
  if (adText.trim().length < MIN_JOB_AD_LENGTH) {
    return EMPTY_COMPACT_JOB_AD;
  }

  const hash = hashJobAd(adText);
  const supabase = createServiceRoleClient();

  const { data: cached } = await supabase
    .from("parsed_job_ads")
    .select("title, company, seniority, must_have_skills, nice_to_have_skills, tools, key_responsibilities, keywords")
    .eq("job_description_hash", hash)
    .maybeSingle();

  if (cached) {
    return cached as CompactJobAd;
  }

  const parsed = await parseJobAd(adText, userId);

  if (!isEmptyResult(parsed)) {
    // Best-effort write: a concurrent parse of the same ad racing this one is expected and
    // harmless (unique_violation, code 23505) - either row would have identical derived
    // content, so whichever wins the race is fine. Any other error is logged, never thrown -
    // the caller already has a good result either way and shouldn't fail on a cache miss.
    const { error } = await supabase.from("parsed_job_ads").insert({
      job_description_hash: hash,
      ...parsed,
    });
    if (error && error.code !== "23505") {
      console.error("getOrParseCompactJobAd: cache write failed", error);
    }
  }

  return parsed;
}
