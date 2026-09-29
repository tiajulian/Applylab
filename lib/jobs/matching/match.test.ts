import { describe, expect, it, vi } from "vitest";
import { findMatches, refreshAllMatches, MATCH_LIMIT } from "@/lib/jobs/matching/match";
import { DEFAULT_WEIGHTS } from "@/lib/jobs/matching/score";
import type { MatchCandidate, MatchProfile, MatchStore } from "@/lib/jobs/matching/store";

const NOW = Date.parse("2026-09-30T00:00:00Z");

function candidate(i: number): MatchCandidate {
  return {
    id: `job-${String(i).padStart(3, "0")}`,
    title: "Frontend Developer",
    company: "Acme",
    description_snippet: "React",
    location_display: "Sydney",
    category_label: "IT Jobs",
    salary_min: null,
    salary_max: null,
    salary_is_predicted: false,
    contract_type: null,
    contract_time: null,
    posted_at: new Date(NOW).toISOString(),
    redirect_url: `https://www.adzuna.com.au/land/ad/${i}`,
    distance: i / 1000,
  };
}

function profile(userId: string): MatchProfile & { userId: string } {
  return {
    userId,
    targetTitles: ["Frontend Developer"],
    skills: ["React"],
    locations: ["Sydney"],
    radiusKm: 50,
    remoteOk: false,
    minSalary: null,
    contractTypes: [],
    embedding: "[0.1,0.2]",
    updatedAt: `2026-09-30T00:00:00Z#${userId}`,
  };
}

function fakeStore() {
  return {
    getCandidates: vi.fn(async (_profile: MatchProfile, _limit: number) => Array.from({ length: 80 }, (_, i) => candidate(i))),
    replaceMatches: vi.fn(
      async (_userId: string, _rows: { job_id: string; score: number; reasons: string[] }[], _profileUpdatedAt: string | null) => true
    ),
    getActiveProfiles: vi.fn(async () => [profile("u1"), profile("u2")]),
  } satisfies MatchStore;
}

describe("findMatches", () => {
  it("recalls 200 candidates and returns the top 50 with their job details", async () => {
    const store = fakeStore();
    const matches = await findMatches(profile("u1"), store, DEFAULT_WEIGHTS, NOW);

    expect(store.getCandidates).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }), 200);
    expect(matches).toHaveLength(MATCH_LIMIT);
    expect(matches[0].job.id).toBe("job-000"); // smallest distance wins when all else is equal
    expect(matches[0].reasons).toContain("Title matches Frontend Developer");
  });
});

describe("refreshAllMatches", () => {
  it("caches matches per user and carries on past one user's failure", async () => {
    const store = fakeStore();
    store.getCandidates.mockRejectedValueOnce(new Error("timeout"));

    await expect(refreshAllMatches(store, DEFAULT_WEIGHTS)).resolves.toEqual({
      users: 1,
      errors: ["matches for u1: timeout"],
    });
    expect(store.replaceMatches).toHaveBeenCalledTimes(1);
    const [userId, rows, profileUpdatedAt] = store.replaceMatches.mock.calls[0];
    expect(userId).toBe("u2");
    expect(profileUpdatedAt).toBe("2026-09-30T00:00:00Z#u2"); // guards the swap against a newer profile save
    expect(rows).toHaveLength(MATCH_LIMIT);
    expect(rows[0]).toMatchObject({ job_id: "job-000", score: expect.any(Number) });
  });

  it("stops starting new users once time runs out", async () => {
    const store = fakeStore();
    let calls = 0;
    const result = await refreshAllMatches(store, DEFAULT_WEIGHTS, () => calls++ < 1);
    expect(result).toEqual({ users: 1, errors: [] });
    expect(store.replaceMatches).toHaveBeenCalledTimes(1);
  });
});
