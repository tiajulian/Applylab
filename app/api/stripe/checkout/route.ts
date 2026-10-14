import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createBillingPortalUrl, PRICE_IDS, stripe, type ProInterval } from "@/lib/stripe/client";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const PRO_INTERVALS: readonly unknown[] = ["month", "quarter"] satisfies ProInterval[];

// On in production (Stripe Tax is active and ApplyLab is GST-registered). Prices are tax-inclusive,
// so this only records the GST inside the price on the invoice; the customer pays the same total.
const AUTOMATIC_TAX_ENABLED = process.env.STRIPE_AUTOMATIC_TAX === "true";

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    const rateLimited = await enforceRateLimit(`stripe-checkout:${authUserId}`, 10, 10 * 60_000);
    if (rateLimited) return rateLimited;


    // interval defaults to monthly so an old client that only sends { plan: "pro" } still works.
    const { plan, resumeId, interval = "month" } = await request.json();

    if (plan !== "pro" && plan !== "resume_unlock") {
      return NextResponse.json(
        { error: "plan must be 'pro' or 'resume_unlock'" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    // Returning customers keep one Stripe customer instead of getting a duplicate per checkout.
    // With automatic tax on, Stripe needs to save the address entered at checkout onto that
    // existing customer to work out GST, or the session errors.
    const customerFields = appUser.stripe_customer_id
      ? {
          customer: appUser.stripe_customer_id,
          ...(AUTOMATIC_TAX_ENABLED ? { customer_update: { address: "auto" as const } } : {}),
        }
      : { customer_email: appUser.email };
    const taxFields = AUTOMATIC_TAX_ENABLED ? { automatic_tax: { enabled: true } } : {};

    if (plan === "resume_unlock") {
      if (!resumeId || typeof resumeId !== "string") {
        return NextResponse.json({ error: "resumeId is required for resume_unlock" }, { status: 400 });
      }

      const supabase = createClient();
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .select("id, user_id, job_title, is_free_allowance")
        .eq("id", resumeId)
        .eq("user_id", authUserId)
        .single();

      if (resumeError || !resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 404 });
      }

      // Already downloadable (Pro or their free-allowance resume): send them back to it instead of
      // charging. Mirrors canExportResume, using the row loaded above.
      if (appUser.plan === "pro" || resume.is_free_allowance) {
        return NextResponse.json({ url: `${appUrl}/resume/${resumeId}` });
      }

      const { data: existingUnlock } = await supabase
        .from("resume_unlocks")
        .select("id")
        .eq("user_id", authUserId)
        .eq("resume_id", resumeId)
        .maybeSingle();

      if (existingUnlock) {
        return NextResponse.json({ url: `${appUrl}/resume/${resumeId}?unlocked=1` });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ...customerFields,
        ...taxFields,
        client_reference_id: authUserId,
        metadata: { userId: authUserId, plan: "resume_unlock", resumeId },
        payment_intent_data: {
          description: `One-time unlock & clean export for "${resume.job_title || "Resume"}"`,
        },
        line_items: [
          {
            price: PRICE_IDS.resumeUnlock,
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/resume/${resumeId}?unlocked=1`,
        cancel_url: `${appUrl}/resume/${resumeId}`,
      });

      return NextResponse.json({ url: session.url });
    }

    if (!PRO_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: "interval must be 'month' or 'quarter'" }, { status: 400 });
    }

    // Already Pro: never start a second subscription. Send them to manage the one they have.
    if (appUser.plan === "pro") {
      if (appUser.stripe_customer_id) {
        return NextResponse.json({ url: await createBillingPortalUrl(appUser.stripe_customer_id) });
      }
      return NextResponse.json({ error: "You're already on Pro." }, { status: 409 });
    }

    const metadata = { userId: authUserId, plan, interval };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...customerFields,
      ...taxFields,
      client_reference_id: authUserId,
      metadata,
      // The subscription carries the user ID too, so the webhook can match subscription events.
      subscription_data: { metadata },
      line_items: [
        {
          price: PRICE_IDS.pro[interval as ProInterval],
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/upgrade`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("stripe checkout error", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
