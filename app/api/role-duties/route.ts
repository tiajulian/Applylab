import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestRoleDuties } from "@/lib/anthropic/roleDuties";
import { normalize } from "@/lib/resume/factCheck";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { RoleDutyItem } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Un-metered (no resumes_used reservation - this only ever helps fill in a profile, never
// generates a resume by itself), so this is the only place that needs its own abuse control.
// Primary control is reuse (see the lookup below); this is the backstop for a user who keeps
// tweaking the job title slightly to force fresh suggestions.
const RATE_LIMIT_PER_HOUR = 10;

/**
 * Duties rung of the Win Builder's personalisation ladder (Part F) - looks up ALREADY confirmed
 * duties for this job title only, never creates a suggestion and never calls Claude, so this rung
 * of the ladder is genuinely zero-API. If the candidate never ran the role-duties flow (or ticked
 * nothing) for this title, this returns an empty list and the ladder falls through to the fixed
 * title-based question bank instead.
 *
 * With `?full=1`, returns the whole suggestion + item set (same shape as the POST reuse branch
 * below) instead of just confirmed duty text, so the profile editor can show a role's existing
 * duty suggestions - including ones still pending a tick - on load without ever calling Claude.
 * Never generates a new suggestion; if none exists yet for this title, `suggestion` is null.
 */
export async function GET(request: Request) {
  try {
    const { authUserId } = await requireUser();
    const url = new URL(request.url);
    const jobTitle = url.searchParams.get("jobTitle") ?? "";
    const full = url.searchParams.get("full") === "1";
    if (!jobTitle.trim()) {
      return NextResponse.json(full ? { suggestion: null, items: [] } : { duties: [] });
    }
    const normalizedJobTitle = normalize(jobTitle);

    const supabase = createClient();

    const { data: suggestion } = await supabase
      .from("role_duty_suggestions")
      .select("*")
      .eq("user_id", authUserId)
      .eq("job_title", normalizedJobTitle)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!suggestion) {
      return NextResponse.json(full ? { suggestion: null, items: [] } : { duties: [] });
    }

    if (full) {
      const { data: items, error: itemsError } = await supabase
        .from("role_duty_items")
        .select("*")
        .eq("suggestion_id", suggestion.id);

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      return NextResponse.json({ suggestion, items: (items ?? []) as RoleDutyItem[] });
    }

    const { data: items } = await supabase
      .from("role_duty_items")
      .select("duty_text, user_edited_text")
      .eq("suggestion_id", suggestion.id)
      .eq("user_state", "confirmed");

    const duties = ((items ?? []) as Pick<RoleDutyItem, "duty_text" | "user_edited_text">[]).map(
      (item) => item.user_edited_text?.trim() || item.duty_text
    );

    return NextResponse.json({ duties });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("role-duties GET error", error);
    return NextResponse.json({ error: "Failed to load role duties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const { jobTitle, company, location } = await request.json();

    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json({ error: "jobTitle is required" }, { status: 400 });
    }
    const normalizedJobTitle = normalize(jobTitle);

    const supabase = createClient();

    // Reuse: same user + same job title (role-based, so company/target job never factor in)
    // reuses the existing suggestions instead of re-calling Claude. Primary abuse control, not
    // the rate limit below - revisiting the same role never re-triggers a Claude call.
    const { data: existingSuggestion } = await supabase
      .from("role_duty_suggestions")
      .select("*")
      .eq("user_id", authUserId)
      .eq("job_title", normalizedJobTitle)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSuggestion) {
      const { data: items, error: itemsError } = await supabase
        .from("role_duty_items")
        .select("*")
        .eq("suggestion_id", existingSuggestion.id);

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      return NextResponse.json({ suggestion: existingSuggestion, items: items ?? [] });
    }

    // Only run suggestion (and burn a Claude call) once we know it isn't reusable. Failures here
    // never touch resumes_used - there is no reservation to fail out of.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateLimitError } = await supabase
      .from("role_duty_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError.message }, { status: 500 });
    }
    if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many duty suggestions. Try again in a bit." },
        { status: 429 }
      );
    }

    const result = await suggestRoleDuties(
      {
        jobTitle: jobTitle.trim(),
        company: typeof company === "string" ? company.trim() : undefined,
        location: typeof location === "string" ? location.trim() : undefined,
      },
      authUserId
    );

    const { data: suggestion, error: suggestionInsertError } = await supabase
      .from("role_duty_suggestions")
      .insert({ user_id: authUserId, job_title: normalizedJobTitle })
      .select()
      .single();

    if (suggestionInsertError || !suggestion) {
      return NextResponse.json(
        { error: suggestionInsertError?.message ?? "Failed to save role duty suggestion" },
        { status: 500 }
      );
    }

    const dutyTexts = result.duties.map((d) => d.duty_text).filter((text) => text.trim().length > 0);

    if (dutyTexts.length === 0) {
      return NextResponse.json({ suggestion, items: [] });
    }

    const { data: items, error: itemsInsertError } = await supabase
      .from("role_duty_items")
      .insert(dutyTexts.map((duty_text) => ({ suggestion_id: suggestion.id, duty_text })))
      .select();

    if (itemsInsertError) {
      return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
    }

    return NextResponse.json({ suggestion, items: (items ?? []) as RoleDutyItem[] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("role-duties error", error);
    return NextResponse.json({ error: "Failed to suggest role duties" }, { status: 500 });
  }
}
