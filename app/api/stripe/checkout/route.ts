import { NextResponse } from "next/server";
import { PRICING, stripe } from "@/lib/stripe/client";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const { plan, resumeId } = await request.json();

    if (plan !== "pro" && plan !== "lifetime" && plan !== "resume_unlock") {
      return NextResponse.json(
        { error: "plan must be 'pro', 'lifetime', or 'resume_unlock'" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    if (plan === "resume_unlock") {
      if (!resumeId || typeof resumeId !== "string") {
        return NextResponse.json({ error: "resumeId is required for resume_unlock" }, { status: 400 });
      }

      const supabase = createClient();
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .select("id, user_id, job_title")
        .eq("id", resumeId)
        .eq("user_id", authUserId)
        .single();

      if (resumeError || !resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 404 });
      }

      // If user already has an active paid plan or has previously unlocked this resume,
      // return early to the resume page rather than charging them again.
      if (appUser.plan === "pro" || appUser.plan === "lifetime") {
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
        customer_email: appUser.email,
        client_reference_id: authUserId,
        metadata: { userId: authUserId, plan: "resume_unlock", resumeId },
        line_items: [
          {
            price_data: {
              currency: "aud",
              unit_amount: PRICING.resume_unlock.amountAud,
              product_data: {
                name: PRICING.resume_unlock.name,
                description: `One-time unlock & clean export for "${resume.job_title || "Resume"}"`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/resume/${resumeId}?unlocked=1`,
        cancel_url: `${appUrl}/resume/${resumeId}`,
      });

      return NextResponse.json({ url: session.url });
    }

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

