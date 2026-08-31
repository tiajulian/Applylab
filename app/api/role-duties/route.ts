import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { suggestRoleDuties, ROLE_DUTIES_PROMPT_VERSION, type RawRoleDuty } from "@/lib/anthropic/roleDuties";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { normalize } from "@/lib/resume/factCheck";
import { requirePermanentUser, UnauthorizedError } from "@/lib/requireUser";
import type { RoleDutyItem } from "@/types";

const ROLE_DUTIES_MODEL = MODEL_BY_FEATURE["role-duties"].model;

// Uses cookies() (via requirePermanentUser/createClient) on every request, so it can never be
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
    const { authUserId } = await requirePermanentUser();
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

    const { data: items, error } = await supabase
      .from("role_duty_items")
      .select("*")
      .eq("suggestion_id", suggestion.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (full) {
      return NextResponse.json({ suggestion, items: (items ?? []) as RoleDutyItem[] });
    }

    const confirmedDuties = (items ?? [])
      .filter((i) => i.user_state === "confirmed")
      .map((i) => i.user_edited_text?.trim() || i.duty_text);

    return NextResponse.json({ duties: confirmedDuties });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const message =
        error.message === "Permanent account required"
          ? "Sign up free to see suggestions."
          : "Unauthorized";
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("role-duties GET error", error);
    return NextResponse.json({ error: "Failed to load role duties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requirePermanentUser();

    const { jobTitle, company, location, regenerate } = await request.json();

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

    let existingItems: RoleDutyItem[] = [];
    if (existingSuggestion) {
      const { data: items, error: itemsError } = await supabase
        .from("role_duty_items")
        .select("*")
        .eq("suggestion_id", existingSuggestion.id);

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
      existingItems = (items ?? []) as RoleDutyItem[];

      // Reusable as-is only if it actually has items and a fresh batch wasn't explicitly
      // requested (see "Get more suggestions" in SuggestTasksBuilder.tsx, used once the
      // candidate has confirmed/rejected everything from an earlier batch and wants more). A
      // suggestion row with zero items (e.g. a prior attempt's items insert failed) would
      // otherwise "cache" a permanently empty result - falls through to generate below instead.
      if (!regenerate && existingItems.length > 0) {
        return NextResponse.json({ suggestion: existingSuggestion, items: existingItems });
      }
    }

    // Global cache: role-duties suggestions depend only on the job title (company/location are
    // flavour the model doesn't actually let shape the output - see the divergence check in
    // supabase/migrations/20260828014600_role_duty_cache.sql), so the same handful of common
    // titles get asked for by many different users. A hit here is checked via the normal
    // authenticated client (RLS grants any authenticated user read access) and skips both the
    // AI call and the per-hour rate limit below entirely - same as the per-user reuse above,
    // reading a shared answer costs nothing to check. Never consulted on regenerate: that's an
    // explicit "give me something different" and must always call the model fresh.
    let rawDuties: RawRoleDuty[] | null = null;
    if (!regenerate) {
      const { data: cached } = await supabase
        .from("role_duty_cache")
        .select("duties")
        .eq("normalized_job_title", normalizedJobTitle)
        .eq("model", ROLE_DUTIES_MODEL)
        .eq("prompt_version", ROLE_DUTIES_PROMPT_VERSION)
        .maybeSingle();
      if (cached) {
        rawDuties = cached.duties as RawRoleDuty[];
      }
    }

    if (!rawDuties) {
      // Only run suggestion (and burn a real AI call) once we know it isn't reusable from either
      // cache. Failures here never touch resumes_used - there is no reservation to fail out of.
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
          excludeDuties: existingItems.map((item) => item.user_edited_text?.trim() || item.duty_text),
        },
        authUserId
      );
      rawDuties = result.duties;

      // Populate the shared cache - service role only, since RLS grants no write policy to
      // `authenticated` (see the migration). Never runs on regenerate: a regenerate's result is
      // this user's personal "more/different" batch, not a replacement for what everyone else
      // reads. The unique index on (normalized_job_title, model, prompt_version) makes a
      // concurrent duplicate insert from another request a silent no-op, not an error - both
      // results are equally valid under the same model/prompt version, so first writer wins and
      // this insert's own failure (if it lost the race) is safe to ignore.
      if (!regenerate) {
        const serviceClient = createServiceRoleClient();
        await serviceClient.from("role_duty_cache").insert({
          normalized_job_title: normalizedJobTitle,
          model: ROLE_DUTIES_MODEL,
          prompt_version: ROLE_DUTIES_PROMPT_VERSION,
          duties: rawDuties,
        });
      }
    }

    // Reuses the existing (item-less, or being topped up via regenerate) suggestion row from
    // above rather than inserting a second one for the same user + job title, which the reuse
    // lookup only ever orders by recency and would otherwise leave the original row's items
    // unreachable.
    let suggestion = existingSuggestion;
    if (!suggestion) {
      const { data: insertedSuggestion, error: suggestionInsertError } = await supabase
        .from("role_duty_suggestions")
        .insert({ user_id: authUserId, job_title: normalizedJobTitle })
        .select()
        .single();

      if (suggestionInsertError || !insertedSuggestion) {
        return NextResponse.json(
          { error: suggestionInsertError?.message ?? "Failed to save role duty suggestion" },
          { status: 500 }
        );
      }
      suggestion = insertedSuggestion;
    }

    // Never repeats a duty_text already attached to this suggestion (from this or an earlier
    // batch) even if Claude's excludeDuties instruction gets ignored - a client-side backstop
    // rather than trusting the prompt alone to prevent visible duplicates in the checkbox list.
    const existingDutyTexts = new Set(existingItems.map((item) => item.duty_text));
    const duties = rawDuties.filter((d) => d.duty_text.trim().length > 0 && !existingDutyTexts.has(d.duty_text));

    if (duties.length === 0) {
      return NextResponse.json({ suggestion, items: existingItems });
    }

    const { data: newItems, error: itemsInsertError } = await supabase
      .from("role_duty_items")
      .insert(duties.map(({ duty_text, category }) => ({ suggestion_id: suggestion.id, duty_text, category })))
      .select();

    if (itemsInsertError) {
      return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
    }

    return NextResponse.json({ suggestion, items: [...existingItems, ...((newItems ?? []) as RoleDutyItem[])] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const message =
        error.message === "Permanent account required"
          ? "Sign up free to get suggestions."
          : "Unauthorized";
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("role-duties error", error);
    return NextResponse.json({ error: "Failed to suggest role duties" }, { status: 500 });
  }
}
