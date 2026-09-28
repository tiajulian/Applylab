import { AdzunaBudgetExceededError, type AdzunaClient, type UsageWindow } from "@/lib/jobs/adzuna/client";
import { mapAdzunaJob, type JobRow } from "@/lib/jobs/adzuna/normalize";
import type { IngestConfig, IngestQuery } from "@/lib/jobs/config";
import type { IngestStore, ProfileQuery } from "@/lib/jobs/ingestion/store";

const RESULTS_PER_PAGE = 50;
const MAX_DAYS_OLD = 2;
const CATEGORY_CACHE_DAYS = 30;
// Profile-driven queries are run first but may use at most this share of a run's calls, so the
// default audience queries always get some budget.
const PROFILE_BUDGET_SHARE = 0.7;

export interface IngestOptions {
  maxCalls?: number;
  dryRun?: boolean;
}

export interface IngestSummary {
  callsUsed: number;
  queriesRun: number;
  jobsFetched: number;
  inserted: number;
  updated: number;
  deduped: number;
  expired: number;
  errors: string[];
  cutShortBy: UsageWindow | null;
  durationMs: number;
}

export type IngestResult =
  | { status: "locked" }
  | { status: "dry_run"; callsUsed: number; query: IngestQuery | null; rows: JobRow[] }
  | { status: "succeeded" | "failed"; summary: IngestSummary };

interface PlannedQuery extends IngestQuery {
  fromProfile: boolean;
}

export interface IngestDeps {
  client: AdzunaClient;
  store: IngestStore;
  config: IngestConfig;
  alert?: (message: string) => Promise<void>;
}

function queryKey(q: IngestQuery): string {
  return [q.what, q.where, q.category].map((v) => v?.trim().toLowerCase() ?? "").join("|");
}

/** Profile queries first (most users first), then the configured defaults, without repeats. */
export function buildQueryPlan(profileQueries: ProfileQuery[], defaults: IngestQuery[]): PlannedQuery[] {
  const seen = new Set<string>();
  const plan: PlannedQuery[] = [];
  const add = (q: IngestQuery, fromProfile: boolean) => {
    const key = queryKey(q);
    if (seen.has(key)) return;
    seen.add(key);
    plan.push({ what: q.what, where: q.where, category: q.category, fromProfile });
  };
  profileQueries.forEach((q) => add(q, true));
  defaults.forEach((q) => add(q, false));
  return plan;
}

function mapPage(results: Parameters<typeof mapAdzunaJob>[0][]): JobRow[] {
  // One row per external_id: a batch upsert cannot touch the same row twice.
  const byId = new Map<string, JobRow>();
  for (const result of results) {
    const row = mapAdzunaJob(result);
    if (row) byId.set(row.external_id, row);
  }
  return [...byId.values()];
}

/** Drops queries whose category tag Adzuna doesn't know, refreshing the cached list when stale. */
async function filterCategories(plan: PlannedQuery[], deps: IngestDeps, errors: string[]): Promise<PlannedQuery[]> {
  if (!plan.some((q) => q.category)) return plan;
  let tags = await deps.store.getCachedCategoryTags(CATEGORY_CACHE_DAYS);
  if (!tags) {
    try {
      const response = await deps.client.categories();
      const categories = (response.results ?? [])
        .filter((c): c is { tag: string; label: string } => Boolean(c.tag && c.label));
      await deps.store.saveCategories(categories);
      tags = categories.map((c) => c.tag);
    } catch (err) {
      errors.push(`categories: ${(err as Error).message}`);
      return plan;
    }
  }
  const known = new Set(tags);
  return plan.filter((q) => {
    if (!q.category || known.has(q.category)) return true;
    errors.push(`unknown category "${q.category}" skipped`);
    return false;
  });
}

export async function runIngestion(deps: IngestDeps, options: IngestOptions = {}): Promise<IngestResult> {
  const { client, store, config } = deps;
  const maxCalls = options.maxCalls ?? config.maxCallsPerRun;

  if (options.dryRun) {
    const query = config.queries[0] ?? null;
    const response = await client.search({
      page: 1,
      ...query,
      resultsPerPage: RESULTS_PER_PAGE,
      maxDaysOld: MAX_DAYS_OLD,
      sortBy: "date",
    });
    return { status: "dry_run", callsUsed: client.callsMade, query, rows: mapPage(response.results ?? []) };
  }

  const runId = await store.startRun();
  if (!runId) return { status: "locked" };

  const startedAt = Date.now();
  const summary: IngestSummary = {
    callsUsed: 0,
    queriesRun: 0,
    jobsFetched: 0,
    inserted: 0,
    updated: 0,
    deduped: 0,
    expired: 0,
    errors: [],
    cutShortBy: null,
    durationMs: 0,
  };

  try {
    const plan = await filterCategories(
      buildQueryPlan(await store.getProfileQueries(), config.queries),
      deps,
      summary.errors
    );
    const profileCap = Math.floor(maxCalls * PROFILE_BUDGET_SHARE);

    queries: for (const query of plan) {
      if (query.fromProfile && client.callsMade >= profileCap) continue;
      if (client.callsMade >= maxCalls) break;
      summary.queriesRun++;

      for (let page = 1; page <= config.maxPagesPerQuery; page++) {
        if (client.callsMade >= maxCalls) break queries;
        if (query.fromProfile && client.callsMade >= profileCap) break;
        let results;
        try {
          const response = await client.search({
            page,
            what: query.what,
            where: query.where,
            category: query.category,
            resultsPerPage: RESULTS_PER_PAGE,
            maxDaysOld: MAX_DAYS_OLD,
            sortBy: "date",
          });
          results = response.results ?? [];
        } catch (err) {
          if (err instanceof AdzunaBudgetExceededError) {
            summary.cutShortBy = err.window;
            break queries;
          }
          summary.errors.push(`${queryKey(query)} p${page}: ${(err as Error).message}`);
          break;
        }

        summary.jobsFetched += results.length;
        const rows = mapPage(results);
        if (rows.length) {
          const { inserted, updated } = await store.upsertJobs(rows);
          summary.inserted += inserted;
          summary.updated += updated;
        }
        if (results.length < RESULTS_PER_PAGE) break;
      }
    }

    summary.deduped = await store.dedupeJobs();
    summary.expired = await store.expireJobs(config.expiryDays, config.maxAgeDays);
  } catch (err) {
    summary.errors.push((err as Error).message);
    return finish("failed");
  }
  return finish("succeeded");

  async function finish(status: "succeeded" | "failed"): Promise<IngestResult> {
    summary.callsUsed = client.callsMade;
    summary.durationMs = Date.now() - startedAt;
    console.info("adzuna-ingest run summary", JSON.stringify({ status, ...summary }));
    await store.finishRun(runId!, status, summary);
    if (summary.cutShortBy) {
      await deps.alert?.(`Adzuna ingestion was cut short: the ${summary.cutShortBy} call budget is used up.`);
    }
    return { status, summary };
  }
}
