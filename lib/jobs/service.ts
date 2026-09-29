import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnauthorizedError } from "@/lib/requireUser";
import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { getMatchWeights } from "@/lib/jobs/config";
import { refreshUserMatches } from "@/lib/jobs/matching/match";
import { toPercent } from "@/lib/jobs/matching/score";
import { createSupabaseMatchStore } from "@/lib/jobs/matching/store";
import { CONTRACT_TYPES, PROFILE_COLUMNS, PROFILE_LIMITS, profileFromRow, type ContractType, type JobProfileRow } from "@/lib/jobs/profile";

export const INTERACTION_ACTIONS = ["saved", "dismissed", "applied_click"] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/** Adzuna job columns every job response needs. */
export const JOB_COLUMNS =
  "id, title, company, location_display, salary_min, salary_max, salary_is_predicted, contract_type, contract_time, description_snippet, posted_at, redirect_url, source, is_active";

export interface JobFields {
  id: string;
  title: string;
  company: string | null;
  location_display: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_is_predicted: boolean;
  contract_type: string | null;
  contract_time: string | null;
  description_snippet: string;
  posted_at: string | null;
  redirect_url: string;
  source: string;
}

export interface JobDto {
  id: string;
  title: string;
  company: string | null;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryIsPredicted: boolean;
  contractType: string | null;
  contractTime: string | null;
  snippet: string;
  postedAt: string | null;
  /** Adzuna's redirect_url exactly as returned - its tracking parameters are required. */
  applyUrl: string;
  source: string;
}

export function toJobDto(job: JobFields): JobDto {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location_display,
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    salaryIsPredicted: job.salary_is_predicted,
    contractType: job.contract_type,
    contractTime: job.contract_time,
    snippet: job.description_snippet,
    postedAt: job.posted_at,
    applyUrl: job.redirect_url,
    source: job.source,
  };
}

/** Shared catch block: 401 for auth, the AI gateway's own refusals, otherwise a logged 500. */
export function jobsErrorResponse(error: unknown, context: string, message: string): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const aiRefusal = aiErrorResponse(error);
  if (aiRefusal) return aiRefusal;
  console.error(`${context} error`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function getProfileRow(supabase: SupabaseClient, userId: string): Promise<JobProfileRow | null> {
  const { data, error } = await supabase.from("job_profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as JobProfileRow | null;
}

/**
 * The cache is fresh when it was computed after the profile's last save and after the latest
 * successful ingestion started (a run refreshes matches only after saving all its jobs, so a cache
 * computed by that run counts as fresh). Otherwise matches are recomputed now (one ~25 ms query
 * plus scoring). All three timestamps come from the database clock, and matches_computed_at is set
 * even when there are zero matches. Returns false when the user has no usable profile yet.
 */
export async function ensureFreshMatches(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [profileRow, lastRun] = await Promise.all([
    getProfileRow(supabase, userId),
    supabase
      .from("adzuna_ingest_runs")
      .select("started_at")
      .eq("status", "succeeded")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!profileRow?.embedding) return false;
  if (lastRun.error) throw lastRun.error;

  const computedAt = profileRow.matches_computed_at;
  const ingestedAt = lastRun.data?.started_at as string | undefined;
  const fresh =
    computedAt !== null &&
    Date.parse(computedAt) >= Date.parse(profileRow.updated_at) &&
    (!ingestedAt || Date.parse(computedAt) >= Date.parse(ingestedAt));

  if (!fresh) {
    const profile = profileFromRow(profileRow);
    await refreshUserMatches(
      { ...profile, userId, embedding: profileRow.embedding, updatedAt: profileRow.updated_at },
      createSupabaseMatchStore(supabase),
      getMatchWeights()
    );
  }
  return true;
}

export interface MatchPageQuery {
  page: number;
  limit: number;
  sort: "score" | "newest";
  location: string | null;
  minSalary: number | null;
  contractTypes: ContractType[];
  maxAgeDays: number | null;
}

const MAX_MATCH_PAGE_LIMIT = 50;
const MAX_POSTED_WITHIN_DAYS = 45;

function positiveInt(value: string | null, fallback: number, max: number): number | null {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/** Parses ?page&limit&sort&location&minSalary&workType=a,b&postedWithinDays. Null = invalid. */
export function parseMatchQuery(params: URLSearchParams): MatchPageQuery | null {
  const page = positiveInt(params.get("page"), 1, 1000);
  const limit = positiveInt(params.get("limit"), 20, MAX_MATCH_PAGE_LIMIT);
  const sort = params.get("sort") ?? "score";
  const minSalary = positiveInt(params.get("minSalary"), 0, PROFILE_LIMITS.maxSalary);
  const maxAgeDays = positiveInt(params.get("postedWithinDays"), 0, MAX_POSTED_WITHIN_DAYS);
  const contractTypes = (params.get("workType") ?? "").split(",").filter(Boolean);
  const location = params.get("location")?.trim().slice(0, PROFILE_LIMITS.itemChars) || null;

  if (page === null || limit === null || minSalary === null || maxAgeDays === null) return null;
  if (sort !== "score" && sort !== "newest") return null;
  if (contractTypes.some((c) => !CONTRACT_TYPES.includes(c as ContractType))) return null;

  return {
    page,
    limit,
    sort,
    location,
    minSalary: minSalary || null,
    contractTypes: contractTypes as ContractType[],
    maxAgeDays: maxAgeDays || null,
  };
}

interface MatchPageRow extends Omit<JobFields, "id"> {
  job_id: string;
  score: number;
  reasons: string[];
  saved: boolean;
  total: number;
}

async function fetchMatchRows(supabase: SupabaseClient, userId: string, query: MatchPageQuery, limit: number, offset: number) {
  const { data, error } = await supabase.rpc("job_matches_page", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
    p_sort: query.sort,
    p_location: query.location,
    p_min_salary: query.minSalary,
    p_contract_types: query.contractTypes,
    p_max_age_days: query.maxAgeDays,
  });
  if (error) throw error;
  return (data ?? []) as MatchPageRow[];
}

export async function getMatchesPage(supabase: SupabaseClient, userId: string, query: MatchPageQuery) {
  const rows = await fetchMatchRows(supabase, userId, query, query.limit, (query.page - 1) * query.limit);
  // Every row carries the filtered total, but a page past the end has no rows to carry it (e.g.
  // after dismissing jobs while on the last page), so ask for the first row instead.
  const total = rows[0]?.total ?? (query.page > 1 ? (await fetchMatchRows(supabase, userId, query, 1, 0))[0]?.total ?? 0 : 0);
  return {
    total,
    matches: rows.map((row) => ({
      job: toJobDto({ ...row, id: row.job_id }),
      score: toPercent(row.score),
      reasons: row.reasons,
      saved: row.saved,
    })),
  };
}
