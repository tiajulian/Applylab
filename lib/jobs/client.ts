// Browser-side calls to the Job Matcher API. Type-only imports keep server code out of the bundle.
import type { JobProfileInput } from "@/lib/jobs/profile";
import type { InteractionAction, JobDto, MatchPageQuery } from "@/lib/jobs/api";

export type { JobDto, JobProfileInput };

export interface MatchItem {
  job: JobDto;
  score: number;
  reasons: string[];
  saved: boolean;
}

/** What the matches are based on (the "Matching you for" bar). */
export interface ProfileSummary {
  targetTitles: string[];
  locations: string[];
  skillCount: number;
  /** Built from the user's own profile and applications, rather than customised. */
  isAuto: boolean;
}

export interface MatchesResponse {
  hasProfile: boolean;
  profile: ProfileSummary | null;
  matches: MatchItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SavedJob {
  job: JobDto;
  isActive: boolean;
  savedAt: string;
}

export type MatchFilters = Omit<MatchPageQuery, "page" | "limit">;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string> = {}
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error ?? "Something went wrong", response.status, body.fields);
  return body as T;
}

export const getJobProfile = () => request<{ profile: JobProfileInput; exists: boolean; isAuto: boolean }>("/api/job-profile");

/** Goes back to the automatic profile built from the user's own data. */
export const resetJobProfile = () => request<{ ok: true }>("/api/job-profile", { method: "DELETE" });

/** `automatic`: keep following the user's own data once it exists (QuickStart's starter titles). */
export const saveJobProfile = (profile: JobProfileInput, { automatic = false } = {}) =>
  request<{ profile: JobProfileInput; matchCount: number | null }>("/api/job-profile", {
    method: "PUT",
    body: JSON.stringify({ ...profile, automatic }),
  });

export function getMatches(page: number, limit: number, filters: MatchFilters): Promise<MatchesResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort: filters.sort });
  if (filters.location) params.set("location", filters.location);
  if (filters.minSalary) params.set("minSalary", String(filters.minSalary));
  if (filters.contractTypes.length) params.set("workType", filters.contractTypes.join(","));
  if (filters.maxAgeDays) params.set("postedWithinDays", String(filters.maxAgeDays));
  return request<MatchesResponse>(`/api/job-matches?${params}`);
}

export const getSavedJobs = () => request<{ jobs: SavedJob[] }>("/api/jobs/saved");

export const addInteraction = (jobId: string, action: InteractionAction) =>
  request<{ ok: true }>(`/api/jobs/${jobId}/interactions`, {
    method: "POST",
    body: JSON.stringify({ action }),
    // Apply opens a new tab; keepalive lets the click record finish even if this tab navigates.
    keepalive: action === "applied_click",
  });

export const removeInteraction = (jobId: string, action: "saved" | "dismissed") =>
  request<{ ok: true }>(`/api/jobs/${jobId}/interactions/${action}`, { method: "DELETE" });
