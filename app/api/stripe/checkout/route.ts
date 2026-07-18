import { NextResponse } from "next/server";
import { PRICING, stripe } from "@/lib/stripe/client";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const { plan } = await request.json();

    if (plan !== "pro" && plan !== "lifetime") {
      return NextResponse.json({ error: "plan must be 'pro' or 'lifetime'" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const session = await stripe.checkout.sessions.create({
      mode: plan === "pro" ? "subscription" : "payment",
      customer_email: appUser.email,
      client_reference_id: authUserId,
      metadata: { userId: authUserId, plan },
      line_items: [
        plan === "pro"
          ? {
              price_data: {
                currency: "aud",
                unit_amount: PRICING.pro.amountAud,
                recurring: { interval: PRICING.pro.interval },
                product_data: { name: PRICING.pro.name },
              },
              quantity: 1,
            }
          : {
              price_data: {
                currency: "aud",
                unit_amount: PRICING.lifetime.amountAud,
                product_data: { name: PRICING.lifetime.name },
              },
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
