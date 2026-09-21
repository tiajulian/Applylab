/**
 * Heavy-compute concurrency policies. Change these numbers HERE only.
 *
 * Per-user concurrency alone allows (#users x N) simultaneous jobs, so each heavy route also has
 * a GLOBAL cap across all users. All numbers are unmeasured starting points: size `globalMax`
 * for Chromium from your function memory setting and provider rate limits, then tune.
 *
 * When the global cap is hit we return 503 + Retry-After rather than queueing (e.g. QStash):
 * these routes are synchronous - the browser is waiting on a file download or an interactive
 * result - so a queue would need an async job/poll/notify flow on the frontend. A fast 503 keeps
 * the current contract, sheds load instantly, and the client can simply retry.
 */
export const HEAVY_JOBS = {
  // Headless Chromium, memory-heavy. Shared by generate-pdf and pdf-blob.
  pdf: { perUser: 1, globalMax: 6, ttlMs: 60_000 },
  "generate-resume": { perUser: 1, globalMax: 40, ttlMs: 120_000 },
  "resume-duplicate": { perUser: 1, globalMax: 20, ttlMs: 120_000 },
  "interview-session": { perUser: 1, globalMax: 20, ttlMs: 120_000 },
  "interview-turn": { perUser: 1, globalMax: 30, ttlMs: 120_000 },
} as const;

export type HeavyJobName = keyof typeof HEAVY_JOBS;
