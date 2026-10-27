import { describe, expect, it, vi, beforeEach } from "vitest";

const cookieNames = new Set<string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieNames.has(name) ? { value: "1" } : undefined),
    has: (name: string) => cookieNames.has(name),
    delete: vi.fn(),
  })),
}));

let onboarded = false;
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "user-1", recovery_sent_at: null } }, error: null }) },
    rpc: vi.fn(),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarded } }) }) }) }),
  }),
}));

import { GET } from "./route";

const callback = (query: string) => GET(new Request(`https://applylab.io/auth/callback?code=abc${query}`));

describe("GET /auth/callback and the resume-score claim", () => {
  beforeEach(() => {
    cookieNames.clear();
    onboarded = false;
  });

  it("sends the scorer's signup to the claim, ahead of onboarding", async () => {
    const res = await callback("&next=%2Fresume-score%2Fclaim");
    expect(res.headers.get("location")).toBe("https://applylab.io/resume-score/claim");
  });

  it("sends an ordinary new account to onboarding, even with a ticket in the browser", async () => {
    cookieNames.add("score_claim");
    const res = await callback("");
    expect(res.headers.get("location")).toBe("https://applylab.io/onboarding");
  });

  it("keeps the claim destination when a scorer sign-in fails", async () => {
    const res = await GET(new Request("https://applylab.io/auth/callback?error=server_error&next=%2Fresume-score%2Fclaim"));
    expect(res.headers.get("location")).toBe(
      "https://applylab.io/login?error=auth_callback_error&redirectedFrom=%2Fresume-score%2Fclaim"
    );
  });

  it("says a Google account is already registered, rather than that the link expired", async () => {
    const res = await GET(
      new Request("https://applylab.io/auth/callback?error=server_error&error_code=identity_already_exists&next=%2Fresume-score%2Fclaim")
    );
    expect(res.headers.get("location")).toBe(
      "https://applylab.io/login?error=identity_exists&redirectedFrom=%2Fresume-score%2Fclaim"
    );
  });

  it("keeps an onboarded user's own destination, even with a ticket in the browser", async () => {
    onboarded = true;
    cookieNames.add("score_claim");
    const res = await callback("&next=%2Fapplications");
    expect(res.headers.get("location")).toBe("https://applylab.io/applications");
  });
});
