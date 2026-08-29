import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/requireUser", () => ({
  requireUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  PRICING: {
    pro: { amountAud: 1900, name: "applylab Pro", interval: "month" },
    lifetime: { amountAud: 7900, name: "applylab Lifetime" },
    resume_unlock: { amountAud: 299, name: "ApplyLab Resume Unlock (One-Time)" },
  },
}));

import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRICING } from "@/lib/stripe/client";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.applylab.com.au";
});

describe("POST /api/stripe/checkout", () => {
  it("returns 401 when user is unauthorized", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid plan", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "test@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "super-plan" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a subscription checkout session for Pro plan", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "test@example.com", plan: "free" } as any,
      isAnonymous: false,
    });
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
      url: "https://checkout.stripe.com/session-123",
    } as any);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.com/session-123");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "test@example.com",
        client_reference_id: "user-1",
        metadata: { userId: "user-1", plan: "pro" },
      })
    );
  });

  it("returns 400 for resume_unlock without resumeId", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "test@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "resume_unlock" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for resume_unlock when resume is not found", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "test@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error("Not found") }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "resume_unlock", resumeId: "res-404" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates a one-time payment checkout session for resume_unlock ($2.99 AUD)", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", email: "test@example.com", plan: "free" } as any,
      isAnonymous: false,
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "resumes") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "res-123", user_id: "user-1", job_title: "Product Manager" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "resume_unlocks") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
      url: "https://checkout.stripe.com/session-unlock-123",
    } as any);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "resume_unlock", resumeId: "res-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://checkout.stripe.com/session-unlock-123");

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer_email: "test@example.com",
        client_reference_id: "user-1",
        metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-123" },
        line_items: [
          {
            price_data: {
              currency: "aud",
              unit_amount: PRICING.resume_unlock.amountAud,
              product_data: {
                name: PRICING.resume_unlock.name,
                description: 'One-time unlock & clean export for "Product Manager"',
              },
            },
            quantity: 1,
          },
        ],
        success_url: "https://app.applylab.com.au/resume/res-123?unlocked=1",
        cancel_url: "https://app.applylab.com.au/resume/res-123",
      })
    );
  });
});
