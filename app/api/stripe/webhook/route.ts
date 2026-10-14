import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { PRO_PRICE_IDS, RESUME_UNLOCK_AMOUNT_AUD_CENTS, stripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// Paid up (or trialling): Pro, no banner.
const PAID_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(["active", "trialing"]);
// Still Pro: past_due means Stripe is retrying a failed card, so Pro stays until it gives up.
const LIVE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([...PAID_STATUSES, "past_due"]);

function customerIdOf(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function isProSubscription(subscription: Stripe.Subscription): boolean {
  const priceId = subscription.items?.data[0]?.price.id;
  return Boolean(priceId && PRO_PRICE_IDS.has(priceId));
}

/**
 * Throws on a failed write so the webhook returns 500 and Stripe retries the event - unless it's
 * a constraint violation (Postgres class 23, e.g. the resume was deleted before the unlock landed),
 * which no retry can fix. Those are logged and skipped, so Stripe doesn't retry for days and
 * eventually disable the endpoint for everyone.
 */
function assertWritten({ error }: { error: unknown }): void {
  if (!error) return;
  if (String((error as { code?: unknown }).code ?? "").startsWith("23")) {
    console.error("stripe webhook: permanent write error, not retrying", error);
    return;
  }
  throw error;
}

type SubscriberFields = { plan: "pro" | "free"; payment_failed: boolean };

/**
 * All of a customer's subscriptions, or null if Stripe doesn't know the customer (deleted, or keys
 * pointing at the wrong account/mode). Retrying can't fix that, so callers never throw on it.
 */
async function listSubscriptions(customerId: string): Promise<Stripe.Subscription[] | null> {
  try {
    return await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }).autoPagingToArray({ limit: 1000 });
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") return null;
    throw error;
  }
}

function liveProSubscriptions(subscriptions: Stripe.Subscription[]): Stripe.Subscription[] {
  return subscriptions.filter((subscription) => LIVE_STATUSES.has(subscription.status) && isProSubscription(subscription));
}

/**
 * Sets the plan from ALL of the customer's Pro subscriptions as they are in Stripe right now, not
 * from the one subscription an event is about. So a retried or late event can't roll back a newer
 * change, and cancelling one of two subscriptions (e.g. paid twice from two checkout tabs) doesn't
 * drop a user who is still paying for the other. Matched by stripe_customer_id, falling back to
 * the user ID the checkout route stamps on the subscription/session metadata.
 *
 * `eventSubscription` is the subscription the event was about, used only when Stripe no longer
 * knows the customer: if that event says it ended (e.g. the customer was deleted, which cancels
 * their subscriptions), the user is moved to Free; otherwise nothing changes, so misconfigured keys
 * can never silently downgrade a paying user.
 */
async function syncCustomer(
  supabase: ServiceClient,
  customerId: string,
  fallbackUserId?: string,
  eventSubscription?: Stripe.Subscription
): Promise<void> {
  let subscriptions = await listSubscriptions(customerId);
  if (!subscriptions) {
    if (!eventSubscription || LIVE_STATUSES.has(eventSubscription.status)) {
      console.error("stripe webhook: customer not found in Stripe, plan left unchanged", { customerId });
      return;
    }
    subscriptions = [];
  }
  const live = liveProSubscriptions(subscriptions);

  const fields: SubscriberFields =
    live.length > 0
      ? // The "update your card" banner shows only when no live subscription is paid up.
        { plan: "pro", payment_failed: !live.some((subscription) => PAID_STATUSES.has(subscription.status)) }
      : { plan: "free", payment_failed: false };

  const result = await supabase.from("users").update(fields).eq("stripe_customer_id", customerId).select("id");
  assertWritten(result);
  if ((result.data ?? []).length > 0 || !fallbackUserId) return;

  // No user is linked to this customer, so fall back to the user ID from metadata.
  if (fields.plan === "free") {
    // Only a user not linked to any customer: one linked to another customer is governed by that
    // customer's subscriptions, and a stale event for an old one must not downgrade them.
    assertWritten(await supabase.from("users").update(fields).eq("id", fallbackUserId).is("stripe_customer_id", null));
    return;
  }

  // A live Pro subscription: link the user to this customer unless their current customer already
  // pays for Pro (e.g. an earlier A$2.99 unlock made a separate customer - this one should win).
  const { data: user, error } = await supabase.from("users").select("stripe_customer_id").eq("id", fallbackUserId).maybeSingle();
  if (error) throw error;
  if (!user) return;
  const current = user.stripe_customer_id as string | null;
  if (current && liveProSubscriptions((await listSubscriptions(current)) ?? []).length > 0) {
    // e.g. two Pro checkout tabs created two Stripe customers: someone is paying twice. Pro is
    // already granted through the linked customer; the duplicate needs a manual refund.
    console.error("stripe webhook: duplicate Pro subscription on an unlinked customer", { customerId, fallbackUserId });
    return;
  }
  assertWritten(await supabase.from("users").update({ ...fields, stripe_customer_id: customerId }).eq("id", fallbackUserId));
}

async function handleEvent(supabase: ServiceClient, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const plan = session.metadata?.plan;
      const resumeId = session.metadata?.resumeId;
      const customerId = customerIdOf(session.customer);

      if (userId && plan === "pro" && session.mode === "subscription" && customerId) {
        // Checkout reuses the user's existing customer, so they're matched by it; a first-time
        // subscriber is linked through the fallback.
        await syncCustomer(supabase, customerId, userId);
      } else if (userId && plan === "resume_unlock" && resumeId && session.payment_status !== "unpaid") {
        // A delayed method (e.g. bank debit) completes checkout "unpaid": the unlock is granted when
        // checkout.session.async_payment_succeeded arrives instead.
        assertWritten(
          await supabase
            .from("resume_unlocks")
            .upsert(
              {
                user_id: userId,
                resume_id: resumeId,
                stripe_session_id: session.id,
                amount_aud: session.amount_total ?? RESUME_UNLOCK_AMOUNT_AUD_CENTS,
                unlocked_at: new Date().toISOString(),
              },
              { onConflict: "user_id,resume_id" }
            )
        );

        if (customerId) {
          assertWritten(
            await supabase
              .from("users")
              .update({ stripe_customer_id: customerId })
              .eq("id", userId)
              .is("stripe_customer_id", null)
          );
        }
      }
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdOf(subscription.customer);
      // Every subscription is synced, even one now on a non-Pro price: a Pro subscription moved
      // off its Pro price must stop granting Pro. syncCustomer only counts Pro prices.
      if (!customerId) return;
      await syncCustomer(supabase, customerId, subscription.metadata?.userId, subscription);
      return;
    }

    default:
      return;
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(createServiceRoleClient(), event);
  } catch (error) {
    // 500 makes Stripe retry the event later. Safe: handlers read the customer's current state from
    // Stripe, so a retry arriving after newer events can't roll them back.
    console.error("stripe webhook handler failed", { type: event.type, error });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
