import { createHash } from "node:crypto";
import type { AdzunaJobResult } from "@/lib/jobs/adzuna/types";

/** One row as accepted by public.adzuna_upsert_jobs(). */
export interface JobRow {
  source: "adzuna";
  external_id: string;
  title: string;
  company: string | null;
  description_snippet: string;
  location_display: string;
  location_area: string[];
  lat: number | null;
  lng: number | null;
  category_tag: string | null;
  category_label: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_is_predicted: boolean;
  contract_type: string | null;
  contract_time: string | null;
  redirect_url: string;
  posted_at: string | null;
  content_hash: string;
}

// 38h week x 52 weeks: the AU full-time standard, for the rare listing quoted per hour.
const HOURS_PER_YEAR = 1976;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value: string | undefined): string | null {
  const cleaned = value ? stripHtml(value) : "";
  return cleaned || null;
}

/** Adzuna AU salaries are annual AUD; anything implausibly low for a year is treated as hourly. */
export function toAnnualSalary(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value < 1000 ? value * HOURS_PER_YEAR : value);
}

function toBool(value: string | number | boolean | undefined): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function toNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function contentHash(title: string, company: string | null, snippet: string): string {
  return createHash("sha256").update(`${title}\n${company ?? ""}\n${snippet}`).digest("hex");
}

/** Maps one Adzuna result to a jobs row, or null when it lacks an id, title or apply link. */
export function mapAdzunaJob(result: AdzunaJobResult): JobRow | null {
  const externalId = result.id === undefined || result.id === null ? "" : String(result.id).trim();
  const title = clean(result.title);
  // redirect_url is used exactly as returned - its tracking parameters are required by Adzuna.
  const redirectUrl = result.redirect_url?.trim();
  if (!externalId || !title || !redirectUrl) return null;

  const company = clean(result.company?.display_name);
  const snippet = clean(result.description) ?? "";
  let salaryMin = toAnnualSalary(result.salary_min);
  let salaryMax = toAnnualSalary(result.salary_max);
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    [salaryMin, salaryMax] = [salaryMax, salaryMin];
  }

  return {
    source: "adzuna",
    external_id: externalId,
    title,
    company,
    description_snippet: snippet,
    location_display: clean(result.location?.display_name) ?? "",
    location_area: (result.location?.area ?? []).filter((a): a is string => typeof a === "string" && a.length > 0),
    lat: toNumber(result.latitude),
    lng: toNumber(result.longitude),
    category_tag: result.category?.tag?.trim() || null,
    category_label: clean(result.category?.label),
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_is_predicted: toBool(result.salary_is_predicted),
    contract_type: result.contract_type?.trim() || null,
    contract_time: result.contract_time?.trim() || null,
    redirect_url: redirectUrl,
    posted_at: toIsoDate(result.created),
    content_hash: contentHash(title, company, snippet),
  };
}
