import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: async () => null,
  acquireConcurrencySlot: async () => async () => {},
}));

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
  PRICE_IDS: {
    pro: { month: "price_pro_month_test", quarter: "price_pro_quarter_test" },
    resumeUnlock: "price_resume_unlock_test",
  },
  createBillingPortalUrl: vi.fn(),
}));

import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRICE_IDS, createBillingPortalUrl } from "@/lib/stripe/client";
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
        metadata: { userId: "user-1", plan: "pro", interval: "month" },
        subscription_data: { metadata: { userId: "user-1", plan: "pro", interval: "month" } },
        line_items: [{ price: PRICE_IDS.pro.month, quantity: 1 }],
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
        payment_intent_data: {
          description: 'One-time unlock & clean export for "Product Manager"',
        },
        line_items: [{ price: PRICE_IDS.resumeUnlock, quantity: 1 }],
        success_url: "https://app.applylab.com.au/resume/res-123?unlocked=1",
        cancel_url: "https://app.applylab.com.au/resume/res-123",
      })
    );
  });

  describe("Pro billing interval", () => {
    function proRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    function signIn(appUser: Record<string, unknown> = {}) {
      vi.mocked(requireUser).mockResolvedValueOnce({
        authUserId: "user-1",
        appUser: { id: "user-1", email: "test@example.com", plan: "free", stripe_customer_id: null, ...appUser } as any,
        isAnonymous: false,
      });
      vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({ url: "https://checkout.stripe.com/s" } as any);
    }

    function createdSession() {
      return vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as any;
    }

    it("charges the monthly price for interval month", async () => {
      signIn();
      const res = await POST(proRequest({ plan: "pro", interval: "month" }));
      expect(res.status).toBe(200);
      expect(createdSession().line_items).toEqual([{ price: "price_pro_month_test", quantity: 1 }]);
    });

    it("charges the quarterly price for interval quarter", async () => {
      signIn();
      const res = await POST(proRequest({ plan: "pro", interval: "quarter" }));
      expect(res.status).toBe(200);
      expect(createdSession().line_items).toEqual([{ price: "price_pro_quarter_test", quantity: 1 }]);
      expect(createdSession().subscription_data.metadata).toEqual({ userId: "user-1", plan: "pro", interval: "quarter" });
    });

    it("defaults to monthly when no interval is sent", async () => {
      signIn();
      await POST(proRequest({ plan: "pro" }));
      expect(createdSession().line_items[0].price).toBe("price_pro_month_test");
    });

    it("rejects an unknown interval with 400", async () => {
      signIn();
      const res = await POST(proRequest({ plan: "pro", interval: "year" }));
      expect(res.status).toBe(400);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("reuses an existing Stripe customer instead of sending the email", async () => {
      signIn({ stripe_customer_id: "cus_existing" });
      await POST(proRequest({ plan: "pro", interval: "month" }));
      expect(createdSession().customer).toBe("cus_existing");
      expect(createdSession().customer_email).toBeUndefined();
    });

    it("sends a Pro user to the billing portal instead of a second subscription", async () => {
      signIn({ plan: "pro", stripe_customer_id: "cus_pro" });
      vi.mocked(createBillingPortalUrl).mockResolvedValueOnce("https://billing.stripe.com/p");
      const res = await POST(proRequest({ plan: "pro", interval: "quarter" }));
      expect(res.status).toBe(200);
      expect((await res.json()).url).toBe("https://billing.stripe.com/p");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("returns 409 for a Pro user with no Stripe customer", async () => {
      signIn({ plan: "pro", stripe_customer_id: null });
      const res = await POST(proRequest({ plan: "pro" }));
      expect(res.status).toBe(409);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("turns on automatic tax and saves the address to a returning customer when enabled", async () => {
      process.env.STRIPE_AUTOMATIC_TAX = "true";
      vi.resetModules();
      const { POST: postWithTax } = await import("./route");
      signIn({ stripe_customer_id: "cus_existing" });
      await postWithTax(proRequest({ plan: "pro", interval: "month" }));
      expect(createdSession().automatic_tax).toEqual({ enabled: true });
      expect(createdSession().customer_update).toEqual({ address: "auto" });
      delete process.env.STRIPE_AUTOMATIC_TAX;
    });
  });
});
