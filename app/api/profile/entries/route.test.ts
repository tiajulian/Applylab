import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, UnauthorizedError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});

vi.mock("@/lib/requireUser", () => ({ requireUser, UnauthorizedError }));

const { createClient, profileRow, profileUpdate, staleWrites } = vi.hoisted(() => {
  const profileRow = { current: null as Record<string, unknown> | null };
  const profileUpdate = vi.fn();
  // How many upcoming writes find the row changed since it was read (0 rows updated).
  const staleWrites = { count: 0 };
  const written = () => {
    if (staleWrites.count > 0) {
      staleWrites.count -= 1;
      return { data: [], error: null };
    }
    return { data: [{ user_id: "user-1" }], error: null };
  };
  const guarded = { eq: () => ({ select: async () => written() }), is: () => ({ select: async () => written() }) };
  const createClient = vi.fn(() => ({
    from: (table: string) =>
      table === "user_profiles"
        ? {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow.current, error: null }) }) }),
            update: (payload: unknown) => {
              profileUpdate(payload);
              return { eq: () => guarded };
            },
          }
        : { update: () => ({ eq: async () => ({ error: null }) }) },
  }));
  return { createClient, profileRow, profileUpdate, staleWrites };
});

vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/profile/entries", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  staleWrites.count = 0;
  requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", full_name: "Jo" } });
  profileRow.current = { user_id: "user-1", work_experience: [], education: [], referees: [], projects: [], skills: [] };
});

describe("POST /api/profile/entries", () => {
  it("returns 401 when signed out", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("no"));
    expect((await post({ section: "referees", entry: { name: "Sam" } })).status).toBe(401);
  });

  it("rejects an unknown section and an entry without its title", async () => {
    expect((await post({ section: "skills", entry: {} })).status).toBe(400);
    expect((await post({ section: "work_experience", entry: { company: "Acme" } })).status).toBe(400);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("appends a cleaned entry to the profile list", async () => {
    const res = await post({ section: "work_experience", entry: { job_title: "Barista", company: "Bean Co", is_current: true, end_date: "2021", extra: "x" } });
    expect(await res.json()).toEqual({ saved: true });
    const saved = profileUpdate.mock.calls[0][0].work_experience;
    expect(saved).toHaveLength(1);
    // The same sanitizer as the full profile save: unknown fields dropped, a current role has no end date.
    expect(saved[0]).toEqual({
      job_title: "Barista",
      company: "Bean Co",
      location: "",
      start_date: "",
      end_date: "",
      is_current: true,
      description: "",
      wins: [],
    });
  });

  it("skips a duplicate instead of adding it twice", async () => {
    profileRow.current!.referees = [{ name: "Sam Lee", title: "", organisation: "", phone: "", email: "" }];
    const res = await post({ section: "referees", entry: { name: " sam lee" } });
    expect(await res.json()).toMatchObject({ saved: true, alreadySaved: true });
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("doesn't create a profile that doesn't exist yet", async () => {
    profileRow.current = null;
    expect(await (await post({ section: "projects", entry: { title: "App" } })).json()).toEqual({ saved: false, reason: "no_profile" });
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("re-reads and retries when the profile changed between reading and writing", async () => {
    staleWrites.count = 1;
    expect(await (await post({ section: "referees", entry: { name: "Sam" } })).json()).toEqual({ saved: true });
    expect(profileUpdate).toHaveBeenCalledTimes(2);

    staleWrites.count = 5;
    expect((await post({ section: "referees", entry: { name: "Alex" } })).status).toBe(409);
  });

  it("stops at the list limit", async () => {
    profileRow.current!.education = Array.from({ length: 30 }, (_, i) => ({ degree: `D${i}`, institution: "" }));
    expect(await (await post({ section: "education", entry: { degree: "New" } })).json()).toEqual({ saved: false, reason: "full" });
  });
});
