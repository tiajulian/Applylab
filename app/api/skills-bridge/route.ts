import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { analyzeSkillsBridge } from "@/lib/anthropic/skillsBridge";
import { anchorBridgeItem } from "@/lib/resume/factCheck";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { normalizeProfile } from "@/lib/profile/normalizeProfile";
import { getMissingMvpFields } from "@/lib/profile/completeness";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { SkillsBridgeItem, UserProfile } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Un-metered (no resumes_used reservation - see part C), so this is the only place that needs
// its own abuse control. Primary control is reuse (see the lookup below); this is the backstop
// for a user who keeps changing the target slightly to force fresh analyses.
const RATE_LIMIT_PER_HOUR = 10;
const IP_RATE_LIMIT_MAX = 15;
const IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || authUserId;

    const body = await request.json();
    const { jobTitle, companyName, jobDescription, turnstileToken } = body ?? {};

    const isVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();

    const ipAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `bridge_ip:${clientIp}`,
      IP_RATE_LIMIT_MAX,
      IP_RATE_LIMIT_WINDOW_MS
    );

    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Too many skills bridge analyses. Please wait a bit before trying again." },
        { status: 429 }
      );
    }

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }
    const normalizedJobTitle = typeof jobTitle === "string" ? jobTitle : "";
    const normalizedCompanyName = typeof companyName === "string" ? companyName : "";

    const supabase = createClient();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    // Normalized (wins/is_current/legacy education dates) the same way generate-resume/route.ts
    // does, so the analysis prompt below never embeds an un-migrated legacy shape (undefined
    // start_date/end_date/is_current for a profile not yet re-saved through the current form).
    const { normalizedProfile: profileData } = normalizeProfile(profile as UserProfile | null);

    if (!profileData || !profileData.work_experience || profileData.work_experience.length === 0) {
      return NextResponse.json(
        { error: "Add your work experience to your profile before building a skills bridge" },
        { status: 422 }
      );
    }

    const scorable = {
      fullName: appUser.full_name || "",
      location: profileData.location ?? null,
      work_rights: profileData.work_rights ?? null,
      phone: profileData.phone ?? null,
      linkedin_url: profileData.linkedin_url ?? null,
      raw_linkedin_paste: profileData.raw_linkedin_paste ?? null,
      skills: profileData.skills ?? [],
      work_experience: profileData.work_experience ?? [],
      education: profileData.education ?? [],
      referees: profileData.referees ?? [],
    };

    const missingFields = getMissingMvpFields(scorable);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Complete your profile before building a skills bridge", missingFields },
        { status: 422 }
      );
    }

    const jobDescriptionHash = hashForScoring(jobDescription);

    // Reuse: same user + same target (title, company, and job description content) reuses the
    // existing analysis instead of re-calling Claude. This is the primary abuse control, not the
    // rate limit below - a legitimate user revisiting the same target never re-triggers analysis.
    const { data: existingBridge } = await supabase
      .from("skills_bridges")
      .select("*")
      .eq("user_id", authUserId)
      .eq("job_title", normalizedJobTitle)
      .eq("company_name", normalizedCompanyName)
      .eq("job_description_hash", jobDescriptionHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingBridge) {
      const { data: items, error: itemsError } = await supabase
        .from("skills_bridge_items")
        .select("*")
        .eq("bridge_id", existingBridge.id);

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }

      const roles = (profileData.work_experience ?? []).map((r) => ({
        company: r.company,
        job_title: r.job_title,
      }));

      return NextResponse.json({ bridge: existingBridge, items: items ?? [], roles });
    }

    // Only run analysis (and burn a Claude call) once we know it isn't reusable. Failures here
    // never touch resumes_used - there is no reservation to fail out of (see part C).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateLimitError } = await supabase
      .from("skills_bridges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError.message }, { status: 500 });
    }
    if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many skills bridge analyses. Try again in a bit." },
        { status: 429 }
      );
    }

    const analysis = await analyzeSkillsBridge(
      profileData,
      { jobTitle: normalizedJobTitle, companyName: normalizedCompanyName, jobDescription },
      authUserId
    );

    const validatedItems = analysis.items.map((item) => anchorBridgeItem(item, profileData));

    const { data: bridge, error: bridgeInsertError } = await supabase
      .from("skills_bridges")
      .insert({
        user_id: authUserId,
        job_title: normalizedJobTitle,
        company_name: normalizedCompanyName,
        job_description_hash: jobDescriptionHash,
        mode: analysis.mode,
      })
      .select()
      .single();

    if (bridgeInsertError || !bridge) {
      return NextResponse.json({ error: bridgeInsertError?.message ?? "Failed to save bridge" }, { status: 500 });
    }

    const { data: items, error: itemsInsertError } = await supabase
      .from("skills_bridge_items")
      .insert(
        validatedItems.map((item) => ({
          bridge_id: bridge.id,
          source_company: item.source_company,
          source_job_title: item.source_job_title,
          source_snippet: item.source_snippet,
          competency: item.competency,
          target_requirement: item.target_requirement,
          state: item.state,
          confidence: item.confidence,
          // Matched items are evidence-backed, so they start pre-confirmed (shown with a
          // "Confirmed" badge immediately); to_confirm needs an explicit yes/no from the user,
          // and gap can never be confirmed at all (enforced again server-side in the PATCH route).
          user_state: item.state === "matched" ? "confirmed" : "pending",
        }))
      )
      .select();

    if (itemsInsertError) {
      return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
    }

    const roles = (profileData.work_experience ?? []).map((r) => ({
      company: r.company,
      job_title: r.job_title,
    }));

    return NextResponse.json({ bridge, items: (items ?? []) as SkillsBridgeItem[], roles });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("skills-bridge error", error);
    return NextResponse.json({ error: "Failed to build skills bridge" }, { status: 500 });
  }
}
