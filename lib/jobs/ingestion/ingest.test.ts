import { describe, expect, it, vi } from "vitest";
import { AdzunaClient, type CallBudget, type ConsumeResult, type UsageWindow } from "@/lib/jobs/adzuna/client";
import type { AdzunaJobResult } from "@/lib/jobs/adzuna/types";
import type { IngestConfig } from "@/lib/jobs/config";
import { buildQueryPlan, runIngestion } from "@/lib/jobs/ingestion/ingest";
import { rankProfileQueries, type IngestStore, type ProfileQuery } from "@/lib/jobs/ingestion/store";

const COUNTS = { minute: 1, day: 1, week: 1, month: 1 };

function job(id: number): AdzunaJobResult {
  return { id: String(id), title: `Job ${id}`, redirect_url: `https://www.adzuna.com.au/land/ad/${id}` };
}

function page(size: number, offset = 0): AdzunaJobResult[] {
  return Array.from({ length: size }, (_, i) => job(offset + i));
}

function fakeStore(overrides: Partial<IngestStore> = {}) {
  const store = {
    startRun: vi.fn(async () => "run-1" as string | null),
    finishRun: vi.fn(async () => {}),
    upsertJobs: vi.fn(async (rows: unknown[]) => ({ inserted: rows.length, updated: 0 })),
    dedupeJobs: vi.fn(async () => 2),
    expireJobs: vi.fn(async () => 3),
    getProfileQueries: vi.fn(async (): Promise<ProfileQuery[]> => []),
    getCachedCategoryTags: vi.fn(async (): Promise<string[] | null> => ["it-jobs"]),
    saveCategories: vi.fn(async () => {}),
    ...overrides,
  };
  return store;
}

function config(overrides: Partial<IngestConfig> = {}): IngestConfig {
  return {
    maxCallsPerRun: 60,
    maxPagesPerQuery: 3,
    expiryDays: 14,
    maxAgeDays: 45,
    queries: [{ where: "Sydney" }, { where: "Melbourne" }],
    ...overrides,
  };
}

/** A client whose fetch serves pages from `pages(url)` and whose budget can block a window after N calls. */
function makeClient(pages: (url: URL) => AdzunaJobResult[] | Response, blockAfter?: { calls: number; window: UsageWindow }) {
  let consumed = 0;
  const budget: CallBudget = {
    consume: async (): Promise<ConsumeResult> => {
      if (blockAfter && consumed >= blockAfter.calls) return { allowed: false, window: blockAfter.window, counts: COUNTS };
      consumed++;
      return { allowed: true, counts: COUNTS };
    },
  };
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const results = pages(new URL(String(input)));
    return results instanceof Response ? results : new Response(JSON.stringify({ results }), { status: 200 });
  });
  const client = new AdzunaClient({
    appId: "id",
    appKey: "key",
    country: "au",
    limits: { minute: 25, day: 250, week: 1000, month: 2500 },
    budget,
    fetch: fetchImpl as typeof fetch,
    sleep: async () => {},
  });
  return { client, fetchImpl };
}

const calledUrls = (fetchImpl: ReturnType<typeof vi.fn>) => fetchImpl.mock.calls.map((c) => new URL(String(c[0])));

describe("runIngestion", () => {
  it("dry run fetches one page and writes nothing", async () => {
    const store = fakeStore();
    const { client, fetchImpl } = makeClient(() => page(50));

    const result = await runIngestion({ client, store, config: config() }, { dryRun: true });

    expect(result).toMatchObject({ status: "dry_run", callsUsed: 1, query: { where: "Sydney" } });
    expect(result.status === "dry_run" && result.rows).toHaveLength(50);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.startRun).not.toHaveBeenCalled();
    expect(store.upsertJobs).not.toHaveBeenCalled();
    expect(store.dedupeJobs).not.toHaveBeenCalled();
    expect(store.expireJobs).not.toHaveBeenCalled();
    expect(store.finishRun).not.toHaveBeenCalled();
  });

  it("does nothing when another run holds the lock", async () => {
    const store = fakeStore({ startRun: vi.fn(async () => null) });
    const { client, fetchImpl } = makeClient(() => page(50));

    await expect(runIngestion({ client, store, config: config() })).resolves.toEqual({ status: "locked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("pages until a short page or the per-query page cap, then dedupes, expires and logs", async () => {
    const store = fakeStore();
    // Sydney: full, full, full (cap 3). Melbourne: full, then a short page.
    const { client, fetchImpl } = makeClient((url) => {
      const pageNo = Number(url.pathname.split("/").pop());
      const offset = (url.searchParams.get("where") === "Sydney" ? 0 : 1000) + pageNo * 100;
      return url.searchParams.get("where") === "Melbourne" && pageNo === 2 ? page(10, offset) : page(50, offset);
    });

    const result = await runIngestion({ client, store, config: config() });

    expect(calledUrls(fetchImpl).map((u) => `${u.searchParams.get("where")}${u.pathname.split("/").pop()}`)).toEqual([
      "Sydney1",
      "Sydney2",
      "Sydney3",
      "Melbourne1",
      "Melbourne2",
    ]);
    expect(calledUrls(fetchImpl)[0].searchParams.get("max_days_old")).toBe("2");
    expect(result).toMatchObject({
      status: "succeeded",
      summary: { callsUsed: 5, queriesRun: 2, jobsFetched: 210, inserted: 210, deduped: 2, expired: 3, cutShortBy: null },
    });
    expect(store.expireJobs).toHaveBeenCalledWith(14, 45);
    expect(store.finishRun).toHaveBeenCalledWith("run-1", "succeeded", expect.objectContaining({ callsUsed: 5 }));
  });

  it("never spends more than maxCalls", async () => {
    const store = fakeStore();
    const { client, fetchImpl } = makeClient(() => page(50));

    const result = await runIngestion({ client, store, config: config() }, { maxCalls: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ status: "succeeded", summary: { callsUsed: 4 } });
  });

  it("stops the run and alerts when an Adzuna budget is used up", async () => {
    const store = fakeStore();
    const alert = vi.fn(async () => {});
    const { client, fetchImpl } = makeClient(() => page(50), { calls: 2, window: "day" });

    const result = await runIngestion({ client, store, config: config(), alert });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "succeeded", summary: { cutShortBy: "day", callsUsed: 2 } });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("day call budget"));
    expect(store.dedupeJobs).toHaveBeenCalled();
  });

  it("records a failing query and moves on to the next", async () => {
    const store = fakeStore();
    const { client } = makeClient((url) =>
      url.searchParams.get("where") === "Sydney" ? new Response("{}", { status: 400 }) : page(5)
    );

    const result = await runIngestion({ client, store, config: config() });
    expect(result).toMatchObject({ status: "succeeded", summary: { queriesRun: 2, jobsFetched: 5 } });
    expect(result.status === "succeeded" && result.summary.errors[0]).toMatch(/sydney.*HTTP 400/);
  });

  it("marks the run failed when the database errors", async () => {
    const store = fakeStore({ upsertJobs: vi.fn(async () => Promise.reject(new Error("db down"))) });
    const { client } = makeClient(() => page(5));

    const result = await runIngestion({ client, store, config: config() });
    expect(result).toMatchObject({ status: "failed", summary: { errors: ["db down"] } });
    expect(store.finishRun).toHaveBeenCalledWith("run-1", "failed", expect.anything());
  });

  it("sends each external_id once per batch", async () => {
    const store = fakeStore();
    const { client } = makeClient(() => [job(1), job(1), job(2)]);

    await runIngestion({ client, store, config: config({ queries: [{ where: "Sydney" }] }) });
    expect(vi.mocked(store.upsertJobs).mock.calls[0][0]).toHaveLength(2);
  });

  it("runs profile queries first but caps them at 70% of the run budget", async () => {
    const profileQueries = Array.from({ length: 10 }, (_, i) => ({ what: `Role ${i}`, where: "Perth", users: 1 }));
    const store = fakeStore({ getProfileQueries: vi.fn(async () => profileQueries) });
    const { client, fetchImpl } = makeClient(() => page(5)); // one page per query

    await runIngestion({ client, store, config: config() }, { maxCalls: 10 });

    const whats = calledUrls(fetchImpl).map((u) => u.searchParams.get("what") ?? u.searchParams.get("where"));
    expect(whats).toEqual(["Role 0", "Role 1", "Role 2", "Role 3", "Role 4", "Role 5", "Role 6", "Sydney", "Melbourne"]);
  });

  it("refreshes a stale category cache and drops unknown category tags", async () => {
    const store = fakeStore({ getCachedCategoryTags: vi.fn(async () => null) });
    const { client, fetchImpl } = makeClient((url) =>
      url.pathname.endsWith("/categories") ? ([{ tag: "it-jobs", label: "IT Jobs" }] as unknown as AdzunaJobResult[]) : page(5)
    );

    const result = await runIngestion({
      client,
      store,
      config: config({ queries: [{ category: "it-jobs" }, { category: "made-up" }] }),
    });

    expect(store.saveCategories).toHaveBeenCalledWith([{ tag: "it-jobs", label: "IT Jobs" }]);
    const searched = calledUrls(fetchImpl).filter((u) => u.pathname.includes("/search/"));
    expect(searched.map((u) => u.searchParams.get("category"))).toEqual(["it-jobs"]);
    expect(result.status === "succeeded" && result.summary.errors).toContain('unknown category "made-up" skipped');
  });
});

describe("query planning", () => {
  it("ranks profile queries by how many users share them", () => {
    const ranked = rankProfileQueries([
      { target_titles: ["Nurse"], locations: ["Perth"] },
      { target_titles: ["Frontend Developer", "nurse "], locations: ["perth", "Sydney"] },
      { target_titles: ["Chef"], locations: [] },
    ]);
    expect(ranked[0]).toEqual({ what: "Nurse", where: "Perth", users: 2 });
    expect(ranked).toContainEqual({ what: "Chef", where: undefined, users: 1 });
    expect(ranked).toHaveLength(5);
  });

  it("puts profile queries before defaults without repeats", () => {
    const plan = buildQueryPlan([{ where: "Sydney", users: 3 }], [{ where: "sydney" }, { where: "Perth" }]);
    expect(plan).toEqual([
      { what: undefined, where: "Sydney", category: undefined, fromProfile: true },
      { what: undefined, where: "Perth", category: undefined, fromProfile: false },
    ]);
  });
});
