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
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkAndRecordRateLimit: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/anthropic/skillsBridge", () => ({
  analyzeSkillsBridge: vi.fn(),
}));

import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createClient } from "@/lib/supabase/server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/skills-bridge", () => {
  it("returns 401 when unauthenticated", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/skills-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: "Software Engineer at Acme", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when Turnstile verification fails", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", full_name: "Jane Doe" },
    });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/skills-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: "Software Engineer at Acme", turnstileToken: "bad-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Verification failed");
  });

  it("returns 429 when IP rate limit is exceeded", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", full_name: "Jane Doe" },
    });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(false); // IP rate limit exceeded

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/skills-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: "Software Engineer at Acme", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("Too many skills bridge analyses");
  });

  it("returns 422 when profile is incomplete (fails MVP check)", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", full_name: "" },
    });
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(true);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                work_experience: [{ job_title: "Dev", company: "Co" }],
                location: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as never);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/skills-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: "Software Engineer at Acme", turnstileToken: "tok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Complete your profile");
  });
});
