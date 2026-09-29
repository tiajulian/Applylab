import { describe, expect, it, vi } from "vitest";
import { AdzunaClient, type CallBudget, type ConsumeResult, type UsageWindow } from "@/lib/jobs/adzuna/client";
import type { AdzunaJobResult } from "@/lib/jobs/adzuna/types";
import type { IngestConfig } from "@/lib/jobs/config";
import { buildQueryPlan, embedPendingJobs, fetchJobsForTitles, runIngestion } from "@/lib/jobs/ingestion/ingest";
import { rankProfileQueries, type IngestStore, type JobToEmbed, type ProfileQuery } from "@/lib/jobs/ingestion/store";

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
    purgeJobs: vi.fn(async () => 4),
    fillJobCoords: vi.fn(async () => 5),
    getProfileQueries: vi.fn(async (): Promise<ProfileQuery[]> => []),
    getCachedCategoryTags: vi.fn(async (): Promise<string[] | null> => ["it-jobs"]),
    saveCategories: vi.fn(async () => {}),
    getJobsToEmbed: vi.fn(async (): Promise<JobToEmbed[]> => []),
    saveJobEmbeddings: vi.fn(async (rows: unknown[]) => rows.length),
  };
  return Object.assign(store, overrides);
}

/** Deterministic fake embedding: one number per text, derived from its length. */
const fakeEmbed = vi.fn(async (texts: string[]) => texts.map((t) => [t.length]));

function pipeline(overrides: { refreshMatches?: (hasTime: () => boolean) => Promise<{ users: number; errors: string[] }> } = {}) {
  return {
    embed: fakeEmbed,
    refreshMatches: overrides.refreshMatches ?? vi.fn(async () => ({ users: 0, errors: [] })),
  };
}

function toEmbed(n: number): JobToEmbed[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `job-${i}`,
    content_hash: `hash-${i}`,
    title: `Job ${i}`,
    company: null,
    category_label: null,
    location_display: "Sydney",
    description_snippet: "",
  }));
}

function config(overrides: Partial<IngestConfig> = {}): IngestConfig {
  return {
    maxCallsPerRun: 60,
    maxPagesPerQuery: 3,
    expiryDays: 14,
    purgeAfterDays: 30,
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

    const result = await runIngestion({ ...pipeline(), client, store, config: config() }, { dryRun: true });

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

    await expect(runIngestion({ ...pipeline(), client, store, config: config() })).resolves.toEqual({ status: "locked" });
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

    const result = await runIngestion({ ...pipeline(), client, store, config: config() });

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
      summary: { callsUsed: 5, queriesRun: 2, jobsFetched: 210, inserted: 210, deduped: 2, expired: 3, purged: 4, located: 5, cutShortBy: null },
    });
    expect(store.expireJobs).toHaveBeenCalledWith(14, 45);
    expect(store.purgeJobs).toHaveBeenCalledWith(30);
    expect(store.finishRun).toHaveBeenCalledWith("run-1", "succeeded", expect.objectContaining({ callsUsed: 5 }));
  });

  it("never spends more than maxCalls", async () => {
    const store = fakeStore();
    const { client, fetchImpl } = makeClient(() => page(50));

    const result = await runIngestion({ ...pipeline(), client, store, config: config() }, { maxCalls: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ status: "succeeded", summary: { callsUsed: 4 } });
  });

  it("stops the run and alerts when an Adzuna budget is used up", async () => {
    const store = fakeStore();
    const alert = vi.fn(async () => {});
    const { client, fetchImpl } = makeClient(() => page(50), { calls: 2, window: "day" });

    const result = await runIngestion({ ...pipeline(), client, store, config: config(), alert });

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

    const result = await runIngestion({ ...pipeline(), client, store, config: config() });
    expect(result).toMatchObject({ status: "succeeded", summary: { queriesRun: 2, jobsFetched: 5 } });
    expect(result.status === "succeeded" && result.summary.errors[0]).toMatch(/sydney.*HTTP 400/);
  });

  it("keeps a run successful when only the purge fails", async () => {
    const store = fakeStore({ purgeJobs: vi.fn(async () => Promise.reject(new Error("adzuna_purge_jobs failed: missing"))) });
    const { client } = makeClient(() => page(5));

    const result = await runIngestion({ ...pipeline(), client, store, config: config() });
    expect(result).toMatchObject({ status: "succeeded", summary: { purged: 0, errors: ["adzuna_purge_jobs failed: missing"] } });
  });

  it("marks the run failed when the database errors", async () => {
    const store = fakeStore({ upsertJobs: vi.fn(async () => Promise.reject(new Error("db down"))) });
    const { client } = makeClient(() => page(5));

    const result = await runIngestion({ ...pipeline(), client, store, config: config() });
    expect(result).toMatchObject({ status: "failed", summary: { errors: ["db down"] } });
    expect(store.finishRun).toHaveBeenCalledWith("run-1", "failed", expect.anything());
  });

  it("sends each external_id once per batch", async () => {
    const store = fakeStore();
    const { client } = makeClient(() => [job(1), job(1), job(2)]);

    await runIngestion({ ...pipeline(), client, store, config: config({ queries: [{ where: "Sydney" }] }) });
    expect(vi.mocked(store.upsertJobs).mock.calls[0][0]).toHaveLength(2);
  });

  it("runs profile queries first but caps them at 70% of the run budget", async () => {
    const profileQueries = Array.from({ length: 10 }, (_, i) => ({ what: `Role ${i}`, where: "Perth", users: 1 }));
    const store = fakeStore({ getProfileQueries: vi.fn(async () => profileQueries) });
    const { client, fetchImpl } = makeClient(() => page(5)); // one page per query

    await runIngestion({ ...pipeline(), client, store, config: config() }, { maxCalls: 10 });

    const whats = calledUrls(fetchImpl).map((u) => u.searchParams.get("what") ?? u.searchParams.get("where"));
    expect(whats).toEqual(["Role 0", "Role 1", "Role 2", "Role 3", "Role 4", "Role 5", "Role 6", "Sydney", "Melbourne"]);
  });

  it("refreshes a stale category cache and drops unknown category tags", async () => {
    const store = fakeStore({ getCachedCategoryTags: vi.fn(async () => null) });
    const { client, fetchImpl } = makeClient((url) =>
      url.pathname.endsWith("/categories") ? ([{ tag: "it-jobs", label: "IT Jobs" }] as unknown as AdzunaJobResult[]) : page(5)
    );

    const result = await runIngestion({
      ...pipeline(),
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

describe("embedding and match refresh", () => {
  it("embeds pending jobs in batches of 100 until none are left", async () => {
    const store = fakeStore();
    store.getJobsToEmbed.mockResolvedValueOnce(toEmbed(100)).mockResolvedValueOnce(toEmbed(30));
    fakeEmbed.mockClear();

    await expect(embedPendingJobs(store, fakeEmbed)).resolves.toBe(130);
    expect(fakeEmbed).toHaveBeenCalledTimes(2);
    expect(store.saveJobEmbeddings.mock.calls[0][0][0]).toEqual({
      id: "job-0",
      content_hash: "hash-0",
      embedding: ["Job 0\n\n\nSydney\n".length],
    });
  });

  it("embeds and refreshes matches after saving jobs, and reports both", async () => {
    const store = fakeStore();
    store.getJobsToEmbed.mockResolvedValueOnce(toEmbed(3));
    const refreshMatches = vi.fn(async () => ({ users: 2, errors: ["matches for u3: boom"] }));
    const { client } = makeClient(() => page(5));

    const result = await runIngestion({ ...pipeline({ refreshMatches }), client, store, config: config() });

    expect(result).toMatchObject({
      status: "succeeded",
      summary: { embedded: 3, matchedUsers: 2, errors: ["matches for u3: boom"] },
    });
    expect(store.upsertJobs.mock.invocationCallOrder[0]).toBeLessThan(store.getJobsToEmbed.mock.invocationCallOrder[0]);
    expect(store.getJobsToEmbed.mock.invocationCallOrder[0]).toBeLessThan(refreshMatches.mock.invocationCallOrder[0]);
  });

  it("stops embedding and match refresh when the 4-minute time budget runs out", async () => {
    const store = fakeStore();
    store.getJobsToEmbed.mockResolvedValue(toEmbed(100));
    let clock = 0;
    const embed = vi.fn(async (texts: string[]) => {
      clock += 100_000; // each batch takes 100s
      return texts.map(() => [0]);
    });
    const refreshMatches = vi.fn(async (hasTime: () => boolean) => ({ users: hasTime() ? 1 : 0, errors: [] }));
    const { client } = makeClient(() => page(5));

    const result = await runIngestion({ ...pipeline({ refreshMatches }), embed, now: () => clock, client, store, config: config() });

    expect(embed).toHaveBeenCalledTimes(3); // 0s, 100s, 200s start a batch; 300s is past 240s
    expect(result).toMatchObject({ status: "succeeded", summary: { embedded: 300, matchedUsers: 0, timeBudgetHit: true } });
    expect(store.finishRun).toHaveBeenCalled();
  });

  it("keeps the run successful when embedding fails", async () => {
    const store = fakeStore();
    store.getJobsToEmbed.mockResolvedValueOnce(toEmbed(3));
    const { client } = makeClient(() => page(5));
    const deps = { ...pipeline(), embed: vi.fn(async () => Promise.reject(new Error("openai down"))), client, store, config: config() };

    const result = await runIngestion(deps);
    expect(result).toMatchObject({ status: "succeeded", summary: { embedded: 0, inserted: 10, errors: ["openai down"] } });
  });
});

describe("fetchJobsForTitles", () => {
  it("searches each title Australia-wide over two weeks, then locates and embeds the new jobs", async () => {
    const { client, fetchImpl } = makeClient(() => page(3));
    const store = fakeStore({ getJobsToEmbed: vi.fn().mockResolvedValueOnce(toEmbed(2)).mockResolvedValue([]) });

    expect(await fetchJobsForTitles({ client, store, embed: fakeEmbed }, ["Analytics Engineer", "Data Analyst"])).toBe(6);
    const urls = calledUrls(fetchImpl);
    expect(urls.map((u) => u.searchParams.get("what"))).toEqual(["Analytics Engineer", "Data Analyst"]);
    expect(urls.every((u) => !u.searchParams.has("where") && u.searchParams.get("max_days_old") === "14")).toBe(true);
    expect(store.fillJobCoords).toHaveBeenCalled();
    expect(store.saveJobEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("still embeds earlier titles' jobs when a later search fails, and stops at the time budget", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, fetchImpl } = makeClient((url) => (url.searchParams.get("what") === "Broken" ? new Response("", { status: 400 }) : page(2)));
    const store = fakeStore({ getJobsToEmbed: vi.fn().mockResolvedValueOnce(toEmbed(2)).mockResolvedValue([]) });
    let checks = 0;
    const hasTime = () => ++checks !== 4; // out of time only at the fourth title

    expect(await fetchJobsForTitles({ client, store, embed: fakeEmbed }, ["Chef", "Broken", "Baker", "Too late"], hasTime)).toBe(4);
    expect(calledUrls(fetchImpl).map((u) => u.searchParams.get("what"))).not.toContain("Too late");
    expect(store.saveJobEmbeddings).toHaveBeenCalled();
  });

  it("skips the follow-up work when nothing new was found", async () => {
    const { client } = makeClient(() => []);
    const store = fakeStore();
    expect(await fetchJobsForTitles({ client, store, embed: fakeEmbed }, ["Astronaut"])).toBe(0);
    expect(store.getJobsToEmbed).not.toHaveBeenCalled();
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
