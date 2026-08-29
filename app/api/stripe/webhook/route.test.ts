import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  PRICING: {
    pro: { amountAud: 1900, name: "applylab Pro", interval: "month" },
    lifetime: { amountAud: 7900, name: "applylab Lifetime" },
    resume_unlock: { amountAud: 299, name: "ApplyLab Resume Unlock (One-Time)" },
  },
}));

import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "raw-body",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhook signature verification fails", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig-invalid" },
      body: "raw-body",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles checkout.session.completed for Pro plan and updates user plan", async () => {
    const mockSession = {
      id: "cs_123",
      customer: "cus_abc",
      client_reference_id: "user-1",
      metadata: { userId: "user-1", plan: "pro" },
    };

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.completed",
      data: { object: mockSession },
    } as any);

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as any);

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig-valid" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: "pro",
      stripe_customer_id: "cus_abc",
    });
  });

  it("handles checkout.session.completed for resume_unlock and inserts into resume_unlocks", async () => {
    const mockSession = {
      id: "cs_unlock_456",
      customer: "cus_unlock_customer",
      client_reference_id: "user-1",
      metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-789" },
    };

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.completed",
      data: { object: mockSession },
    } as any);

    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUserUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "resume_unlocks") {
          return { upsert: mockUpsert };
        }
        if (table === "users") {
          return { update: mockUserUpdate };
        }
        return {};
      }),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as any);

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig-valid" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockSupabase.from).toHaveBeenCalledWith("resume_unlocks");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        resume_id: "res-789",
        stripe_session_id: "cs_unlock_456",
        amount_aud: 299,
      }),
      { onConflict: "user_id,resume_id" }
    );
  });
});
