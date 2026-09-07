import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  FreeTierFeatureLimitReachedError,
  refundFreeTierFeature,
  requireUser,
  reserveFreeTierFeature,
  UnauthorizedError,
} from "@/lib/requireUser";
import { generateFollowupDraft } from "@/lib/anthropic/followupDraft";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Stopgap only (spec §12 step 1): this route spent AI tokens behind nothing but authentication
// before this check existed - a per-feature reserve/gateway port is the real fix, tracked
// separately. Same shape/limit as the other soft-capped AI routes (win-starters, projects/enhance).
const RATE_LIMIT_PER_HOUR = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: followup, error } = await supabase
      .from("application_followups")
      .select("*")
      .eq("application_id", params.id)
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ followup: followup ?? null });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("get-followup-draft error", error);
    return NextResponse.json({ error: "Failed to load follow-up" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  let reserved = false;
  let reservedForUserId: string | null = null;

  try {
    const { authUserId, appUser } = await requireUser();

    // 1. Fetch application
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, user_id, company_name, job_title, applied_date, status")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // 2. Fetch user profile for candidate name
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    // 3. Fetch past interviews for application
    const { data: interviews } = await supabase
      .from("application_interviews")
      .select("stage_type, interviewers, scheduled_at, outcome")
      .eq("application_id", params.id)
      .order("scheduled_at", { ascending: true });

    const candidateName = appUser?.full_name || profile?.full_name || "Applicant";

    const isPostInterview = application.status === "interviewing" || (interviews && interviews.length > 0);
    const reason = isPostInterview ? "post_interview" : "post_applied";

    const allowed = await checkAndRecordRateLimit(
      createServiceRoleClient(),
      `followup-draft:${authUserId}`,
      RATE_LIMIT_PER_HOUR,
      RATE_LIMIT_WINDOW_MS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Draft limit reached for now. Try again shortly." },
        { status: 429 }
      );
    }

    // Free-tier account-level cap (spec: "just like resume/assist limitation") - separate from
    // the hourly stopgap above, which only bounds a burst, not repeated use over days.
    await reserveFreeTierFeature(supabase, appUser, "followup-draft");
    reserved = true;
    reservedForUserId = authUserId;

    const draftResult = await generateFollowupDraft(
      {
        candidateName,
        companyName: application.company_name,
        jobTitle: application.job_title,
        appliedDate: application.applied_date,
        interviews: (interviews as any[]) ?? [],
        reason,
      },
      authUserId,
      supabase,
      appUser.plan
    );

    const fullDraftText = `Subject: ${draftResult.subject}\n\n${draftResult.body}`;

    const { data: followup, error: insertError } = await supabase
      .from("application_followups")
      .insert({
        application_id: params.id,
        user_id: authUserId,
        draft_text: fullDraftText,
        model: draftResult.model,
      })
      .select()
      .single();

    if (insertError || !followup) {
      await refundFreeTierFeature(supabase, authUserId, "followup-draft").catch((refundError) =>
        console.error("failed to refund followup-draft reservation", refundError)
      );
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to save draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({ followup });
  } catch (error) {
    if (reserved && reservedForUserId) {
      await refundFreeTierFeature(supabase, reservedForUserId, "followup-draft").catch((refundError) =>
        console.error("failed to refund followup-draft reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeTierFeatureLimitReachedError) {
      return NextResponse.json(
        { error: "Free follow-up draft limit reached", code: "FREE_LIMIT_REACHED", limit: error.limit },
        { status: 403 }
      );
    }
    console.error("create-followup-draft error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const json = await request.json().catch(() => ({}));
    const { followup_id, edited_text, copied_at } = json;

    if (!followup_id) {
      return NextResponse.json({ error: "followup_id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof edited_text === "string") updates.edited_text = edited_text;
    if (typeof copied_at === "string") updates.copied_at = copied_at;

    const { data: updated, error } = await supabase
      .from("application_followups")
      .update(updates)
      .eq("id", followup_id)
      .eq("application_id", params.id)
      .eq("user_id", authUserId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message ?? "Followup not found" }, { status: 404 });
    }

    return NextResponse.json({ followup: updated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("patch-followup error", error);
    return NextResponse.json({ error: "Failed to update followup" }, { status: 500 });
  }
}
