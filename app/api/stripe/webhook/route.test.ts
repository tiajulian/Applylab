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
  PRO_PRICE_IDS: new Set(["price_month", "price_quarter"]),
  RESUME_UNLOCK_AMOUNT_AUD_CENTS: 299,
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
      mode: "subscription",
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
      amount_total: 299,
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

  describe("customer.subscription.updated", () => {
    function sendSubscription(status: string, priceId: string, metadata: Record<string, string> = {}) {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: { id: "sub_1", customer: "cus_abc", status, metadata, items: { data: [{ price: { id: priceId } }] } },
        },
      } as any);
      return POST(
        new Request("http://localhost/api/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": "sig-valid" },
          body: "{}",
        })
      );
    }

    function mockUsers(matchedByCustomer: boolean) {
      const byCustomer = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: matchedByCustomer ? [{ id: "user-1" }] : [], error: null }),
      });
      const byId = vi.fn().mockResolvedValue({ data: null, error: null });
      const update = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((column: string, value: string) =>
          column === "stripe_customer_id" ? byCustomer(value) : byId(value)
        ),
      });
      vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn().mockReturnValue({ update }) } as any);
      return { update, byCustomer, byId };
    }

    it("makes an active subscription on a new price Pro", async () => {
      const { update, byCustomer } = mockUsers(true);
      const res = await sendSubscription("active", "price_quarter");
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith({ plan: "pro", payment_failed: false });
      expect(byCustomer).toHaveBeenCalledWith("cus_abc");
    });

    it("moves an unpaid subscription to Free", async () => {
      const { update } = mockUsers(true);
      await sendSubscription("unpaid", "price_month");
      expect(update).toHaveBeenCalledWith({ plan: "free", payment_failed: false });
    });

    it("leaves the plan alone for an unknown price", async () => {
      const { update } = mockUsers(true);
      const res = await sendSubscription("active", "price_something_else");
      expect(res.status).toBe(200);
      expect(update).not.toHaveBeenCalled();
    });

    it("keeps a past_due subscription on Pro and flags the failed payment", async () => {
      const { update } = mockUsers(true);
      await sendSubscription("past_due", "price_month");
      expect(update).toHaveBeenCalledWith({ payment_failed: true });
    });

    it("falls back to the user ID in subscription metadata", async () => {
      const { update, byId } = mockUsers(false);
      await sendSubscription("active", "price_month", { userId: "user-9" });
      expect(update).toHaveBeenLastCalledWith({ plan: "pro", payment_failed: false, stripe_customer_id: "cus_abc" });
      expect(byId).toHaveBeenCalledWith("user-9");
    });
  });

  it("does not grant Pro for a non-subscription session claiming plan pro", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.completed",
      data: { object: { id: "cs_x", customer: "cus_x", mode: "payment", metadata: { userId: "user-1", plan: "pro" } } },
    } as any);
    const from = vi.fn();
    vi.mocked(createServiceRoleClient).mockReturnValue({ from } as any);

    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "s" }, body: "{}" })
    );
    expect(res.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });
});
