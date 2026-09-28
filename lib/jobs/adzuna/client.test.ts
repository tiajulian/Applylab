import { describe, expect, it, vi } from "vitest";
import fixture from "@/lib/jobs/__fixtures__/adzunaSearch.json";
import {
  AdzunaBudgetExceededError,
  AdzunaClient,
  AdzunaHttpError,
  type CallBudget,
  type ConsumeResult,
  type UsageWindow,
} from "@/lib/jobs/adzuna/client";

const LIMITS = { minute: 25, day: 250, week: 1000, month: 2500 };
const COUNTS = { minute: 1, day: 1, week: 1, month: 1 };

function allowingBudget(): CallBudget & { consume: ReturnType<typeof vi.fn> } {
  return { consume: vi.fn(async (): Promise<ConsumeResult> => ({ allowed: true, counts: COUNTS })) };
}

function blockedResult(window: UsageWindow): ConsumeResult {
  return { allowed: false, window, counts: COUNTS };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function makeClient(overrides: { budget?: CallBudget; fetch?: typeof fetch } = {}) {
  const sleep = vi.fn(async () => {});
  const fetchImpl = overrides.fetch ?? vi.fn(async () => jsonResponse(fixture));
  const client = new AdzunaClient({
    appId: "test-id",
    appKey: "test-secret-key",
    country: "au",
    limits: LIMITS,
    budget: overrides.budget ?? allowingBudget(),
    fetch: fetchImpl,
    sleep,
    now: () => 30_000,
  });
  return { client, sleep, fetchImpl };
}

describe("AdzunaClient", () => {
  it("builds the search URL with the country, page and params", async () => {
    const { client, fetchImpl } = makeClient();
    const response = await client.search({ page: 2, what: "nurse", where: "Sydney", maxDaysOld: 2, sortBy: "date" });

    const url = new URL(String(vi.mocked(fetchImpl).mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/api/jobs/au/search/2");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      app_id: "test-id",
      app_key: "test-secret-key",
      results_per_page: "50",
      what: "nurse",
      where: "Sydney",
      max_days_old: "2",
      sort_by: "date",
    });
    expect(url.searchParams.has("category")).toBe(false);
    expect(response.results).toHaveLength(3);
    expect(client.callsMade).toBe(1);
  });

  it.each(["day", "week", "month"] as const)("stops without calling Adzuna when the %s budget is used up", async (window) => {
    const budget = { consume: vi.fn(async () => blockedResult(window)) };
    const { client, fetchImpl, sleep } = makeClient({ budget });

    await expect(client.search({ page: 1 })).rejects.toThrow(AdzunaBudgetExceededError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(budget.consume).toHaveBeenCalledTimes(1);
  });

  it("waits out a full minute window once, then proceeds", async () => {
    const budget = allowingBudget();
    budget.consume.mockResolvedValueOnce(blockedResult("minute"));
    const { client, fetchImpl, sleep } = makeClient({ budget });

    await client.search({ page: 1 });
    expect(sleep).toHaveBeenCalledWith(31_000); // to the next minute boundary (+1s) from t=30s
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops when the minute window is still full after waiting", async () => {
    const budget = { consume: vi.fn(async () => blockedResult("minute")) };
    const { client, fetchImpl } = makeClient({ budget });

    await expect(client.search({ page: 1 })).rejects.toMatchObject({ window: "minute" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries 5xx up to 2 times with backoff, counting every attempt", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(fixture));
    const budget = allowingBudget();
    const { client, sleep } = makeClient({ fetch: fetchImpl, budget });

    await expect(client.search({ page: 1 })).resolves.toMatchObject({ count: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(budget.consume).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
    expect(client.callsMade).toBe(3);
  });

  it("gives up after 2 retries on persistent 5xx", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    const { client } = makeClient({ fetch: fetchImpl });

    await expect(client.search({ page: 1 })).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 429])("does not retry HTTP %i", async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, status));
    const { client } = makeClient({ fetch: fetchImpl });

    await expect(client.search({ page: 1 })).rejects.toThrow(AdzunaHttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries network errors and never leaks the app key in the error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed for https://api.adzuna.com/?app_key=test-secret-key");
    });
    const { client } = makeClient({ fetch: fetchImpl });

    const error = await client.search({ page: 1 }).catch((e: Error) => e);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(error)).not.toContain("test-secret-key");
  });

  it("warns once when a budget reaches 80%", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const budget = { consume: vi.fn(async (): Promise<ConsumeResult> => ({ allowed: true, counts: { ...COUNTS, day: 200 } })) };
    const { client } = makeClient({ budget });

    await client.search({ page: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("day budget at 80%"));
    warn.mockRestore();
  });

  it("refuses to construct without credentials", () => {
    expect(
      () => new AdzunaClient({ appId: "", appKey: "", country: "au", limits: LIMITS, budget: allowingBudget() })
    ).toThrow(/ADZUNA_APP_ID/);
  });
});
