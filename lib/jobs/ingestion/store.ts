import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestQuery } from "@/lib/jobs/config";
import type { JobRow } from "@/lib/jobs/adzuna/normalize";

// A run left 'running' this long died mid-way (e.g. a function timeout) and no longer holds the lock.
const STALE_RUN_MINUTES = 15;
const ACTIVE_PROFILE_DAYS = 30;

export interface ProfileQuery extends IngestQuery {
  users: number;
}

/** Everything ingestion reads or writes, so the service can run against an in-memory fake in tests. */
export interface IngestStore {
  /** Returns a run id, or null when another run holds the lock. */
  startRun(): Promise<string | null>;
  finishRun(runId: string, status: "succeeded" | "failed", summary: unknown): Promise<void>;
  upsertJobs(rows: JobRow[]): Promise<{ inserted: number; updated: number }>;
  dedupeJobs(): Promise<number>;
  expireJobs(notSeenDays: number, maxAgeDays: number): Promise<number>;
  /** Deletes inactive, unsaved jobs not seen for inactiveDays. */
  purgeJobs(inactiveDays: number): Promise<number>;
  /** Distinct (title, location) pairs from recently active profiles, most users first. */
  getProfileQueries(): Promise<ProfileQuery[]>;
  /** Cached category tags, or null when the cache is missing or older than maxAgeDays. */
  getCachedCategoryTags(maxAgeDays: number): Promise<string[] | null>;
  saveCategories(categories: { tag: string; label: string }[]): Promise<void>;
}

export function createSupabaseIngestStore(supabase: SupabaseClient): IngestStore {
  return {
    async startRun() {
      const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
      await supabase
        .from("adzuna_ingest_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), summary: { error: "stale run lock released" } })
        .eq("status", "running")
        .lt("started_at", staleBefore);

      const { data, error } = await supabase.from("adzuna_ingest_runs").insert({ status: "running" }).select("id").single();
      if (error?.code === "23505") return null;
      if (error) throw new Error(`startRun failed: ${error.message}`);
      return data.id as string;
    },

    async finishRun(runId, status, summary) {
      const { error } = await supabase
        .from("adzuna_ingest_runs")
        .update({ status, summary, finished_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw new Error(`finishRun failed: ${error.message}`);
    },

    async upsertJobs(rows) {
      const { data, error } = await supabase.rpc("adzuna_upsert_jobs", { p_rows: rows });
      if (error) throw new Error(`adzuna_upsert_jobs failed: ${error.message}`);
      const row = (data as { inserted: number; updated: number }[])[0];
      return { inserted: row?.inserted ?? 0, updated: row?.updated ?? 0 };
    },

    async dedupeJobs() {
      const { data, error } = await supabase.rpc("adzuna_dedupe_jobs");
      if (error) throw new Error(`adzuna_dedupe_jobs failed: ${error.message}`);
      return data as number;
    },

    async expireJobs(notSeenDays, maxAgeDays) {
      const { data, error } = await supabase.rpc("adzuna_expire_jobs", {
        p_not_seen_days: notSeenDays,
        p_max_age_days: maxAgeDays,
      });
      if (error) throw new Error(`adzuna_expire_jobs failed: ${error.message}`);
      return data as number;
    },

    async purgeJobs(inactiveDays) {
      const { data, error } = await supabase.rpc("adzuna_purge_jobs", { p_inactive_days: inactiveDays });
      if (error) throw new Error(`adzuna_purge_jobs failed: ${error.message}`);
      return data as number;
    },

    async getProfileQueries() {
      const since = new Date(Date.now() - ACTIVE_PROFILE_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("job_profiles")
        .select("target_titles, locations")
        .gte("updated_at", since);
      if (error) throw new Error(`getProfileQueries failed: ${error.message}`);
      return rankProfileQueries((data ?? []) as { target_titles: string[]; locations: string[] }[]);
    },

    async getCachedCategoryTags(maxAgeDays) {
      const since = Date.now() - maxAgeDays * 86_400_000;
      const { data, error } = await supabase.from("adzuna_categories").select("tag, fetched_at");
      if (error) throw new Error(`getCachedCategoryTags failed: ${error.message}`);
      if (!data?.length || data.some((c) => new Date(c.fetched_at).getTime() < since)) return null;
      return data.map((c) => c.tag as string);
    },

    async saveCategories(categories) {
      const fetchedAt = new Date().toISOString();
      await supabase.from("adzuna_categories").delete().neq("tag", "");
      const { error } = await supabase
        .from("adzuna_categories")
        .insert(categories.map((c) => ({ ...c, fetched_at: fetchedAt })));
      if (error) throw new Error(`saveCategories failed: ${error.message}`);
    },
  };
}

/** Turns profiles into distinct (title, location) queries, weighted by how many users share them. */
export function rankProfileQueries(profiles: { target_titles: string[]; locations: string[] }[]): ProfileQuery[] {
  const byKey = new Map<string, ProfileQuery>();
  for (const profile of profiles) {
    const titles = (profile.target_titles ?? []).map((t) => t.trim()).filter(Boolean);
    const locations = (profile.locations ?? []).map((l) => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    for (const what of titles) {
      for (const where of locations.length ? locations : [undefined]) {
        const key = `${what.toLowerCase()}|${where?.toLowerCase() ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = byKey.get(key);
        if (existing) existing.users++;
        else byKey.set(key, { what, where, users: 1 });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.users - a.users);
}
