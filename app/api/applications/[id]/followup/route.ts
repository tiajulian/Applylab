import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFollowupDraft } from "@/lib/anthropic/followupDraft";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: followup, error } = await supabase
    .from("application_followups")
    .select("*")
    .eq("application_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ followup: followup ?? null });
}

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch application
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("id, user_id, company_name, job_title, applied_date, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (appError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // 2. Fetch user profile for candidate name
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // 3. Fetch past interviews for application
  const { data: interviews } = await supabase
    .from("application_interviews")
    .select("stage_type, interviewers, scheduled_at, outcome")
    .eq("application_id", id)
    .order("scheduled_at", { ascending: true });

  const candidateName = profile?.full_name || user.user_metadata?.full_name || "Applicant";

  const isPostInterview = application.status === "interviewing" || (interviews && interviews.length > 0);
  const reason = isPostInterview ? "post_interview" : "post_applied";

  try {
    const draftResult = await generateFollowupDraft(
      {
        candidateName,
        companyName: application.company_name,
        jobTitle: application.job_title,
        appliedDate: application.applied_date,
        interviews: interviews ?? [],
        reason,
      },
      user.id
    );

    const fullDraftText = `Subject: ${draftResult.subject}\n\n${draftResult.body}`;

    const { data: followup, error: insertError } = await supabase
      .from("application_followups")
      .insert({
        application_id: id,
        user_id: user.id,
        draft_text: fullDraftText,
        model: draftResult.model,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ followup });
  } catch (err) {
    console.error("Failed to generate followup draft:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .eq("application_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ followup: updated });
}
