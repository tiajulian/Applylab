import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermanentUser, UnauthorizedError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requirePermanentUser: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/requireUser", () => ({
  requirePermanentUser,
  UnauthorizedError,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/openai/client", () => ({
  openai: {},
}));

vi.mock("@/lib/anthropic/roleDuties", () => ({
  suggestRoleDuties: vi.fn(),
  ROLE_DUTIES_PROMPT_VERSION: 1,
}));

import { createClient } from "@/lib/supabase/server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/role-duties", () => {
  it("rejects unauthenticated or anonymous calls with 401", async () => {
    requirePermanentUser.mockRejectedValueOnce(new UnauthorizedError("Permanent account required"));
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/role-duties?jobTitle=Engineer");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty duties when no suggestion exists", async () => {
    requirePermanentUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1" } });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as never);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/role-duties?jobTitle=Engineer");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duties).toEqual([]);
  });

  it("retrieves confirmed role duties without querying non-existent columns", async () => {
    requirePermanentUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1" } });
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "role_duty_suggestions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: "sugg-1", user_id: "user-1", job_title: "software engineer" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "role_duty_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "i1", duty_text: "Built microservices", user_state: "confirmed", user_edited_text: null },
                  { id: "i2", duty_text: "Fixed bugs", user_state: "rejected", user_edited_text: null },
                ],
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as never);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/role-duties?jobTitle=Software%20Engineer");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duties).toEqual(["Built microservices"]);
  });
});
