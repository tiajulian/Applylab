// Every Job Matcher tunable, read from env with safe defaults (documented in .env.example).

export interface IngestQuery {
  what?: string;
  where?: string;
  category?: string;
}

// Broad per-city queries for ApplyLab's core audience (AU job seekers across all fields), plus
// remote roles. With max_days_old=2 and up to 3 pages each this is ~40 calls and ~2,000 fresh
// jobs a day - sized for the Supabase free tier (see adzuna_purge_jobs for the storage maths).
const DEFAULT_INGEST_QUERIES: IngestQuery[] = [
  { where: "Sydney" },
  { where: "Melbourne" },
  { where: "Brisbane" },
  { where: "Perth" },
  { where: "Adelaide" },
  { where: "Canberra" },
  { where: "Hobart" },
  { where: "Darwin" },
  { where: "Gold Coast" },
  { where: "Newcastle" },
  { where: "Sunshine Coast" },
  { where: "Wollongong" },
  { where: "Geelong" },
  { what: "remote" },
];

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseQueries(raw: string | undefined): IngestQuery[] {
  if (!raw) return DEFAULT_INGEST_QUERIES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed
      .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
      .map((q) => ({
        what: typeof q.what === "string" ? q.what : undefined,
        where: typeof q.where === "string" ? q.where : undefined,
        category: typeof q.category === "string" ? q.category : undefined,
      }));
  } catch (err) {
    console.warn(`INGEST_QUERIES is not a valid JSON array, using defaults (${(err as Error).message})`);
    return DEFAULT_INGEST_QUERIES;
  }
}

export function getAdzunaConfig() {
  return {
    appId: process.env.ADZUNA_APP_ID ?? "",
    appKey: process.env.ADZUNA_APP_KEY ?? "",
    country: process.env.ADZUNA_COUNTRY || "au",
    limits: {
      minute: intEnv("ADZUNA_LIMIT_PER_MINUTE", 25),
      day: intEnv("ADZUNA_LIMIT_PER_DAY", 250),
      week: intEnv("ADZUNA_LIMIT_PER_WEEK", 1000),
      month: intEnv("ADZUNA_LIMIT_PER_MONTH", 2500),
    },
  };
}

export type AdzunaLimits = ReturnType<typeof getAdzunaConfig>["limits"];

export function getIngestConfig() {
  return {
    maxCallsPerRun: intEnv("INGEST_MAX_CALLS_PER_RUN", 60),
    maxPagesPerQuery: intEnv("INGEST_MAX_PAGES_PER_QUERY", 3),
    expiryDays: intEnv("JOB_EXPIRY_DAYS", 14),
    purgeAfterDays: intEnv("JOB_PURGE_DAYS", 30),
    maxAgeDays: 45,
    queries: parseQueries(process.env.INGEST_QUERIES),
  };
}

export type IngestConfig = ReturnType<typeof getIngestConfig>;
