import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const cookieValues = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined) })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { GET } from "./route";

function signedInAs(user: { id: string; is_anonymous: boolean } | null) {
  vi.mocked(createClient).mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } } as any);
}

function claimReturns(result: { data: string | null; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as any);
  return rpc;
}

const request = () => new Request("https://applylab.io/resume-score/claim");
const clearsCookie = (res: Response) => /score_claim=;/.test(res.headers.get("set-cookie") ?? "");

describe("GET /resume-score/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValues.clear();
  });

  it("sends a visitor who isn't signed in to log in and back, keeping the cookie", async () => {
    signedInAs(null);
    cookieValues.set("score_claim", "tok");

    const res = await GET(request());
    expect(res.headers.get("location")).toBe("https://applylab.io/login?redirectedFrom=%2Fresume-score%2Fclaim");
    expect(clearsCookie(res)).toBe(false);
  });

  it("treats a guest session as not signed in", async () => {
    signedInAs({ id: "guest-1", is_anonymous: true });
    cookieValues.set("score_claim", "tok");

    const res = await GET(request());
    expect(res.headers.get("location")).toContain("/login?");
  });

  it("claims the held score by the token's hash and opens its report", async () => {
    signedInAs({ id: "user-1", is_anonymous: false });
    cookieValues.set("score_claim", "tok");
    const rpc = claimReturns({ data: "resume-9", error: null });

    const res = await GET(request());
    expect(rpc).toHaveBeenCalledWith("claim_pending_resume_score", {
      p_claim_hash: createHash("sha256").update("tok").digest("hex"),
      p_user_id: "user-1",
    });
    expect(res.headers.get("location")).toBe("https://applylab.io/resume/resume-9/review");
    expect(clearsCookie(res)).toBe(true);
  });

  it("goes to the dashboard and clears the cookie when nothing can be claimed", async () => {
    signedInAs({ id: "user-1", is_anonymous: false });
    cookieValues.set("score_claim", "expired");
    claimReturns({ data: null, error: null });

    const res = await GET(request());
    expect(res.headers.get("location")).toBe("https://applylab.io/dashboard");
    expect(clearsCookie(res)).toBe(true);
  });

  it("keeps the ticket when the claim errors and returns to the score page to retry", async () => {
    signedInAs({ id: "user-1", is_anonymous: false });
    cookieValues.set("score_claim", "tok");
    claimReturns({ data: null, error: { message: "db down" } });

    const res = await GET(request());
    expect(res.headers.get("location")).toBe("https://applylab.io/resume-score?claim=failed");
    expect(clearsCookie(res)).toBe(false);
  });

  it("goes to the dashboard without calling the database when there's no cookie", async () => {
    signedInAs({ id: "user-1", is_anonymous: false });
    const rpc = claimReturns({ data: null, error: null });

    const res = await GET(request());
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://applylab.io/dashboard");
  });
});
