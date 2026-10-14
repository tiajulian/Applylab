import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { createClient } from "@/lib/supabase/server";

// Uses cookies() (via requireUser/createClient) on every request, so it is never statically rendered.
export const dynamic = "force-dynamic";

/**
 * The caller's plan and lifetime free-tier feature usage, for the "N left" labels on capped AI
 * buttons (lib/hooks/useFreeUsesLeft.ts). With `?resumeId=`, also that resume's "Improve with AI"
 * edits used (a per-resume allowance). Pro users get no usage: they have no caps.
 */
export async function GET(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    if (appUser.plan !== "free") {
      return NextResponse.json({ plan: appUser.plan, used: {} });
    }

    const resumeId = new URL(request.url).searchParams.get("resumeId");
    const supabase = createClient();
    const [{ data, error }, resumeResult] = await Promise.all([
      supabase.from("free_tier_feature_usage").select("feature, count").eq("user_id", authUserId),
      resumeId
        ? supabase.from("resumes").select("assist_calls_used").eq("id", resumeId).eq("user_id", authUserId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (error) throw error;
    if (resumeResult.error) throw resumeResult.error;

    return NextResponse.json({
      plan: appUser.plan,
      used: Object.fromEntries((data ?? []).map((row) => [row.feature, row.count])),
      ...(resumeResult.data ? { assistUsed: resumeResult.data.assist_calls_used } : {}),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("free usage lookup error", error);
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
