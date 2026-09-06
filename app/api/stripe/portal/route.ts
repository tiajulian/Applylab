import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

// Uses cookies() (via requireUser) on every request, so it can never be statically rendered —
// declared explicitly to skip Next's failed static-render attempt during build.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { appUser } = await requireUser();

    if (!appUser.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const session = await stripe.billingPortal.sessions.create({
      customer: appUser.stripe_customer_id,
      return_url: `${appUrl}/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("stripe billing portal error", error);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
