import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";

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

      if (userId && (plan === "pro" || plan === "lifetime")) {
        await supabase
          .from("users")
          .update({
            plan,
            stripe_customer_id:
              typeof session.customer === "string" ? session.customer : session.customer?.id,
          })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await supabase
        .from("users")
        .update({ plan: "free" })
        .eq("stripe_customer_id", customerId)
        .neq("plan", "lifetime");
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
