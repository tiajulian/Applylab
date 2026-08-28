import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, UnauthorizedError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  UnauthorizedError,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkAndRecordRateLimit: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/anthropic/parseProfile", () => ({
  parseProfileFromText: vi.fn().mockResolvedValue({ fullName: "Jane Doe" }),
  ProfileParseError: class ProfileParseError extends Error {},
}));

import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/profile/parse", () => {
  it("returns 401 when unauthenticated", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Profile text", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when Turnstile verification fails", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1" } });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Profile text", turnstileToken: "bad-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Verification failed");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1" } });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(false); // user rate limit exceeded

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Profile text", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("Too many document parses");
  });

  it("returns parsed profile when within rate limits and verified", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1" } });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue(true); // both user and IP allowed

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Jane Doe Senior Engineer", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toEqual({ fullName: "Jane Doe" });
  });
});
