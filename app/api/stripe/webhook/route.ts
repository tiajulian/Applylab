import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { PRO_PRICE_IDS, RESUME_UNLOCK_AMOUNT_AUD_CENTS, stripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

const PRO_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(["active", "trialing"]);
const ENDED_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(["canceled", "unpaid", "incomplete_expired"]);

function customerIdOf(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function isProSubscription(subscription: Stripe.Subscription): boolean {
  const priceId = subscription.items?.data[0]?.price.id;
  return Boolean(priceId && PRO_PRICE_IDS.has(priceId));
}

type SubscriberFields = { plan?: "pro" | "free"; payment_failed: boolean };

/**
 * Updates a subscriber's plan / payment-failed flag, matched by stripe_customer_id and falling
 * back to the user ID the checkout route stamps on the subscription's metadata. Every write is a
 * plain set, so a redelivered event leaves the row exactly as the first delivery did.
 */
async function updateSubscriber(
  supabase: ServiceClient,
  subscription: Stripe.Subscription,
  fields: SubscriberFields
): Promise<void> {
  const customerId = customerIdOf(subscription.customer);

  if (customerId) {
    const { data } = await supabase.from("users").update(fields).eq("stripe_customer_id", customerId).select("id");
    if (data && data.length > 0) return;
  }

  const userId = subscription.metadata?.userId;
  if (userId) {
    await supabase
      .from("users")
      .update(fields.plan === "pro" && customerId ? { ...fields, stripe_customer_id: customerId } : fields)
      .eq("id", userId);
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

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const plan = session.metadata?.plan;
      const resumeId = session.metadata?.resumeId;
      const customerId = customerIdOf(session.customer);

      if (userId && plan === "pro" && session.mode === "subscription") {
        await supabase
          .from("users")
          .update({ plan, stripe_customer_id: customerId })
          .eq("id", userId);
      } else if (userId && plan === "resume_unlock" && resumeId) {
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
          );

        if (customerId) {
          await supabase
            .from("users")
            .update({ stripe_customer_id: customerId })
            .eq("id", userId)
            .is("stripe_customer_id", null);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;

      // Not a Pro price: never touch the plan, whatever its status.
      if (!isProSubscription(subscription)) break;

      if (ENDED_STATUSES.has(subscription.status)) {
        await updateSubscriber(supabase, subscription, { plan: "free", payment_failed: false });
      } else if (PRO_STATUSES.has(subscription.status)) {
        await updateSubscriber(supabase, subscription, { plan: "pro", payment_failed: false });
      } else if (subscription.status === "past_due") {
        // Stripe is still retrying the card: keep Pro until it gives up (status -> unpaid/canceled),
        // and flag it so the dashboard asks them to update their card.
        await updateSubscriber(supabase, subscription, { payment_failed: true });
      }
      // Any other status: leave the plan as it is.
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (isProSubscription(subscription)) {
        await updateSubscriber(supabase, subscription, { plan: "free", payment_failed: false });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
