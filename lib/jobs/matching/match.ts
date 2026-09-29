import { rankCandidates, type MatchWeights } from "@/lib/jobs/matching/score";
import type { MatchCandidate, MatchProfile, MatchStore } from "@/lib/jobs/matching/store";

const RECALL_LIMIT = 200;
export const MATCH_LIMIT = 50;

export interface RankedMatch {
  job: MatchCandidate;
  score: number;
  reasons: string[];
}

/** Hard filters + vector recall (SQL), then the weighted rescore. Returns the top 50. */
export async function findMatches(
  profile: MatchProfile,
  store: MatchStore,
  weights: MatchWeights,
  now = Date.now()
): Promise<RankedMatch[]> {
  const candidates = await store.getCandidates(profile, RECALL_LIMIT);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return rankCandidates(candidates, profile, weights, now, MATCH_LIMIT).map((m) => ({
    job: byId.get(m.jobId)!,
    score: m.score,
    reasons: m.reasons,
  }));
}

/** Recomputes and caches matches for one user. */
export async function refreshUserMatches(
  profile: MatchProfile & { userId: string },
  store: MatchStore,
  weights: MatchWeights
): Promise<RankedMatch[]> {
  const matches = await findMatches(profile, store, weights);
  await store.replaceMatches(
    profile.userId,
    matches.map((m) => ({ job_id: m.job.id, score: m.score, reasons: m.reasons })),
    profile.updatedAt ?? null
  );
  return matches;
}

/** Recomputes the cache for every recently active profile until time runs out; one user's
 * failure doesn't stop the rest. Users not reached keep their previous (stale) cache. */
export async function refreshAllMatches(
  store: MatchStore,
  weights: MatchWeights,
  hasTime: () => boolean = () => true
): Promise<{ users: number; errors: string[] }> {
  const profiles = await store.getActiveProfiles();
  const errors: string[] = [];
  let users = 0;
  for (const profile of profiles) {
    if (!hasTime()) break;
    try {
      await refreshUserMatches(profile, store, weights);
      users++;
    } catch (err) {
      errors.push(`matches for ${profile.userId}: ${(err as Error).message}`);
    }
  }
  return { users, errors };
}
