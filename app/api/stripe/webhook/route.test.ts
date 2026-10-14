import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      list: vi.fn(),
    },
  },
  PRO_PRICE_IDS: new Set(["price_month", "price_quarter"]),
  RESUME_UNLOCK_AMOUNT_AUD_CENTS: 299,
}));

import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { POST } from "./route";

type FakeSubscription = { id: string; status: string; price?: string };

/** What Stripe currently lists for the customer (the webhook reads this, not the event payload). */
function stripeHas(subscriptions: FakeSubscription[]) {
  vi.mocked(stripe.subscriptions.list).mockReturnValue({
    autoPagingToArray: vi.fn().mockResolvedValue(
      subscriptions.map(({ id, status, price = "price_month" }) => ({ id, status, items: { data: [{ price: { id: price } }] } }))
    ),
  } as any);
}

/**
 * Records every users update; the customer-id match finds a user unless `matchedByCustomer` is
 * false. `linkedCustomer` is the user's current stripe_customer_id, read by the fallback link.
 */
function fakeUsers({
  matchedByCustomer = true,
  error = null as Error | null,
  linkedCustomer = null as string | null,
} = {}) {
  const writes: { fields: unknown; column: string; value: string }[] = [];
  const supabase = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { stripe_customer_id: linkedCustomer }, error: null }) }),
      }),
      update: (fields: unknown) => ({
        eq: (column: string, value: string) => {
          writes.push({ fields, column, value });
          const result = {
            data: column === "stripe_customer_id" && matchedByCustomer ? [{ id: "user-1" }] : [],
            error,
          };
          const settled = { then: (resolve: (v: unknown) => void) => resolve(result) };
          const selectable = { ...settled, select: () => Promise.resolve(result) };
          return { ...selectable, is: () => selectable };
        },
      }),
    })),
  };
  vi.mocked(createServiceRoleClient).mockReturnValue(supabase as never);
  return writes;
}

function send(type: string, object: Record<string, unknown>) {
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({ type, data: { object } } as any);
  return POST(
    new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "s" }, body: "{}" })
  );
}

function subscriptionEvent(type: string, status: string, price = "price_month", metadata: Record<string, string> = {}) {
  return send(type, { id: "sub_1", customer: "cus_abc", status, metadata, items: { data: [{ price: { id: price } }] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeHas([]);
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

  it("handles checkout.session.completed for resume_unlock and inserts into resume_unlocks", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUserUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "resume_unlocks") return { upsert: mockUpsert };
        if (table === "users") return { update: mockUserUpdate };
        return {};
      }),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as any);

    const res = await send("checkout.session.completed", {
      id: "cs_unlock_456",
      customer: "cus_unlock_customer",
      client_reference_id: "user-1",
      metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-789" },
      amount_total: 299,
    });
    expect(res.status).toBe(200);
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

  it("grants Pro after a Pro checkout once Stripe shows the subscription active", async () => {
    stripeHas([{ id: "sub_1", status: "active" }]);
    const writes = fakeUsers();
    const res = await send("checkout.session.completed", {
      id: "cs_1",
      customer: "cus_abc",
      mode: "subscription",
      metadata: { userId: "user-1", plan: "pro" },
    });
    expect(res.status).toBe(200);
    expect(writes[0]).toEqual({ fields: { plan: "pro", payment_failed: false }, column: "stripe_customer_id", value: "cus_abc" });
  });

  it("does not grant Pro from a late checkout retry once the subscription is cancelled", async () => {
    stripeHas([{ id: "sub_1", status: "canceled" }]);
    const writes = fakeUsers();
    await send("checkout.session.completed", {
      id: "cs_1",
      customer: "cus_abc",
      mode: "subscription",
      metadata: { userId: "user-1", plan: "pro" },
    });
    expect(writes[0].fields).toEqual({ plan: "free", payment_failed: false });
  });

  it("links a first-time subscriber through the user ID when no user has the customer yet", async () => {
    stripeHas([{ id: "sub_1", status: "active" }]);
    const writes = fakeUsers({ matchedByCustomer: false });
    await send("checkout.session.completed", {
      id: "cs_1",
      customer: "cus_new",
      mode: "subscription",
      metadata: { userId: "user-1", plan: "pro" },
    });
    expect(writes[1]).toEqual({
      fields: { plan: "pro", payment_failed: false, stripe_customer_id: "cus_new" },
      column: "id",
      value: "user-1",
    });
  });

  it("waits for a delayed payment to clear before granting a resume unlock", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ upsert })) } as any);
    await send("checkout.session.completed", {
      id: "cs_1",
      payment_status: "unpaid",
      metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-1" },
    });
    expect(upsert).not.toHaveBeenCalled();

    await send("checkout.session.async_payment_succeeded", {
      id: "cs_1",
      payment_status: "paid",
      metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-1" },
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("leaves the plan alone (no retry loop) when Stripe doesn't know the customer of a live subscription", async () => {
    vi.mocked(stripe.subscriptions.list).mockReturnValue({
      autoPagingToArray: vi.fn().mockRejectedValue(Object.assign(new Error("No such customer"), { code: "resource_missing" })),
    } as any);
    const writes = fakeUsers();
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await subscriptionEvent("customer.subscription.updated", "active");
    expect(res.status).toBe(200);
    expect(writes).toHaveLength(0);
  });

  it("does not grant Pro for a non-subscription session claiming plan pro", async () => {
    const writes = fakeUsers();
    const res = await send("checkout.session.completed", {
      id: "cs_x",
      customer: "cus_x",
      mode: "payment",
      metadata: { userId: "user-1", plan: "pro" },
    });
    expect(res.status).toBe(200);
    expect(writes).toHaveLength(0);
  });

  describe("subscription events (plan follows all of the customer's Pro subscriptions in Stripe)", () => {
    it("active subscription -> Pro", async () => {
      stripeHas([{ id: "sub_1", status: "active" }]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "active");
      expect(writes).toEqual([
        { fields: { plan: "pro", payment_failed: false }, column: "stripe_customer_id", value: "cus_abc" },
      ]);
    });

    it("past_due -> stays Pro with the card banner", async () => {
      stripeHas([{ id: "sub_1", status: "past_due" }]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "past_due");
      expect(writes[0].fields).toEqual({ plan: "pro", payment_failed: true });
    });

    it("unpaid -> Free", async () => {
      stripeHas([{ id: "sub_1", status: "unpaid" }]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "unpaid");
      expect(writes[0].fields).toEqual({ plan: "free", payment_failed: false });
    });

    it("cancelling one of two Pro subscriptions keeps the user on Pro", async () => {
      stripeHas([
        { id: "sub_1", status: "canceled" },
        { id: "sub_2", status: "active" },
      ]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.deleted", "canceled");
      expect(writes[0].fields).toEqual({ plan: "pro", payment_failed: false });
    });

    it("no card banner while another live subscription is paid up", async () => {
      stripeHas([
        { id: "sub_1", status: "past_due" },
        { id: "sub_2", status: "active" },
      ]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "past_due");
      expect(writes[0].fields).toEqual({ plan: "pro", payment_failed: false });
    });

    it("a late 'active' event can't undo a cancellation (reads Stripe's current state)", async () => {
      stripeHas([{ id: "sub_1", status: "canceled" }]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "active");
      expect(writes[0].fields).toEqual({ plan: "free", payment_failed: false });
    });

    it("a subscription moved off its Pro price stops granting Pro", async () => {
      stripeHas([{ id: "sub_1", status: "active", price: "price_other" }]);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.updated", "active", "price_other");
      expect(writes[0].fields).toEqual({ plan: "free", payment_failed: false });
    });

    it("a Pro subscription takes over the link from a customer that has no live Pro (e.g. an old unlock)", async () => {
      vi.mocked(stripe.subscriptions.list).mockImplementation(({ customer }: any) => ({
        autoPagingToArray: vi.fn().mockResolvedValue(
          customer === "cus_abc" ? [{ id: "sub_1", status: "active", items: { data: [{ price: { id: "price_month" } }] } }] : []
        ),
      }) as any);
      const writes = fakeUsers({ matchedByCustomer: false, linkedCustomer: "cus_unlock" });
      await subscriptionEvent("customer.subscription.updated", "active", "price_month", { userId: "user-9" });
      expect(writes[1]).toEqual({
        fields: { plan: "pro", payment_failed: false, stripe_customer_id: "cus_abc" },
        column: "id",
        value: "user-9",
      });
    });

    it("moves a user to Free when their customer was deleted and the event says the subscription ended", async () => {
      vi.mocked(stripe.subscriptions.list).mockReturnValue({
        autoPagingToArray: vi.fn().mockRejectedValue(Object.assign(new Error("No such customer"), { code: "resource_missing" })),
      } as any);
      const writes = fakeUsers();
      await subscriptionEvent("customer.subscription.deleted", "canceled");
      expect(writes[0].fields).toEqual({ plan: "free", payment_failed: false });
    });

    it("falls back to the user ID in subscription metadata and links the customer", async () => {
      stripeHas([{ id: "sub_1", status: "active" }]);
      const writes = fakeUsers({ matchedByCustomer: false });
      await subscriptionEvent("customer.subscription.updated", "active", "price_month", { userId: "user-9" });
      expect(writes[1]).toEqual({
        fields: { plan: "pro", payment_failed: false, stripe_customer_id: "cus_abc" },
        column: "id",
        value: "user-9",
      });
    });
  });

  it("skips (200, no retry loop) a write that can never succeed, like a deleted resume's unlock", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: { code: "23503", message: "fk violation" } });
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ upsert })) } as any);
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await send("checkout.session.completed", {
      id: "cs_1",
      metadata: { userId: "user-1", plan: "resume_unlock", resumeId: "res-gone" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 500 so Stripe retries when the database write fails", async () => {
    stripeHas([{ id: "sub_1", status: "active" }]);
    fakeUsers({ error: new Error("db down") });
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await subscriptionEvent("customer.subscription.updated", "active");
    expect(res.status).toBe(500);
  });
});
