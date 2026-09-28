import type { AdzunaLimits } from "@/lib/jobs/config";
import type {
  AdzunaCategoriesResponse,
  AdzunaSearchParams,
  AdzunaSearchResponse,
} from "@/lib/jobs/adzuna/types";

const BASE_URL = "https://api.adzuna.com/v1/api/jobs";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;

export type UsageWindow = keyof AdzunaLimits;
export type UsageCounts = Record<UsageWindow, number>;

export type ConsumeResult =
  | { allowed: true; counts: UsageCounts }
  | { allowed: false; window: UsageWindow; counts: UsageCounts };

/** Persisted call counter. Must check every window and count the call atomically. */
export interface CallBudget {
  consume(): Promise<ConsumeResult>;
}

export class AdzunaBudgetExceededError extends Error {
  constructor(public readonly window: UsageWindow) {
    super(`Adzuna ${window} call budget used up`);
    this.name = "AdzunaBudgetExceededError";
  }
}

export class AdzunaHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Adzuna request failed with HTTP ${status}`);
    this.name = "AdzunaHttpError";
  }
}

export interface AdzunaClientOptions {
  appId: string;
  appKey: string;
  country: string;
  limits: AdzunaLimits;
  budget: CallBudget;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class AdzunaClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private calls = 0;

  constructor(private readonly options: AdzunaClientOptions) {
    if (!options.appId || !options.appKey) {
      throw new Error("ADZUNA_APP_ID and ADZUNA_APP_KEY must be set");
    }
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  /** HTTP calls this client has made (retries included), for run-budget accounting. */
  get callsMade(): number {
    return this.calls;
  }

  search(params: AdzunaSearchParams): Promise<AdzunaSearchResponse> {
    const query: Record<string, string | undefined> = {
      results_per_page: String(params.resultsPerPage ?? 50),
      what: params.what || undefined,
      where: params.where || undefined,
      category: params.category || undefined,
      max_days_old: params.maxDaysOld ? String(params.maxDaysOld) : undefined,
      sort_by: params.sortBy,
    };
    return this.request<AdzunaSearchResponse>(`search/${params.page}`, query);
  }

  categories(): Promise<AdzunaCategoriesResponse> {
    return this.request<AdzunaCategoriesResponse>("categories", {});
  }

  private async request<T>(path: string, query: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`${BASE_URL}/${this.options.country}/${path}`);
    url.searchParams.set("app_id", this.options.appId);
    url.searchParams.set("app_key", this.options.appKey);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    for (let attempt = 0; ; attempt++) {
      await this.acquireCall();
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (attempt >= MAX_RETRIES) throw new Error(`Adzuna network error: ${(err as Error).name}`);
        await this.sleep(BACKOFF_BASE_MS * 2 ** attempt);
        continue;
      }

      if (response.ok) return (await response.json()) as T;
      if (response.status < 500 || attempt >= MAX_RETRIES) throw new AdzunaHttpError(response.status);
      await this.sleep(BACKOFF_BASE_MS * 2 ** attempt);
    }
  }

  /** Counts one call against every window. A full minute window is waited out once; any longer
   * window being full stops the caller outright (never retried). */
  private async acquireCall(): Promise<void> {
    let result = await this.options.budget.consume();
    if (!result.allowed && result.window === "minute") {
      await this.sleep(60_000 - (this.now() % 60_000) + 1_000);
      result = await this.options.budget.consume();
    }
    if (!result.allowed) throw new AdzunaBudgetExceededError(result.window);
    this.calls++;
    this.warnNearLimit(result.counts);
  }

  private warnNearLimit(counts: UsageCounts): void {
    for (const window of ["day", "week", "month"] as const) {
      const threshold = Math.ceil(this.options.limits[window] * 0.8);
      if (counts[window] === threshold) {
        console.warn(`Adzuna ${window} budget at 80% (${counts[window]}/${this.options.limits[window]})`);
      }
    }
  }
}
