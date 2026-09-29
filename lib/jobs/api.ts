// Pure Job Matcher API helpers (no database or AI imports), shared by routes, the service and
// the browser client.
import { CONTRACT_TYPES, PROFILE_LIMITS, type ContractType } from "@/lib/jobs/profile";

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
