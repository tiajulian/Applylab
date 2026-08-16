import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResume } from "@/lib/anthropic/generateResume";
import {
  FREE_RESUME_LIMIT,
  FreeLimitReachedError,
  refundResumeGeneration,
  requireUser,
  reserveResumeGeneration,
  UnauthorizedError,
} from "@/lib/requireUser";
import { getMissingMvpFields } from "@/lib/profile/completeness";
import { normalizeWorkExperience } from "@/lib/profile/normalizeWorkExperience";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import {
  buildConfirmedBridge,
  buildConfirmedRoleDuties,
  flagUnconfirmedBridgeClaims,
  flagUnverifiedFacts,
  normalize,
} from "@/lib/resume/factCheck";
import { runQualityGate } from "@/lib/resume/qualityGate";
import type {
  ConfirmedBridge,
  ConfirmedRoleDuty,
  RoleDutyItem,
  RoleDutySuggestion,
  SkillsBridge,
  SkillsBridgeItem,
  UserProfile,
  WorkExperienceEntry,
} from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

type SupabaseServerClient = ReturnType<typeof createClient>;

/**
 * Best-effort fetch: a bridgeId that doesn't resolve (RLS-scoped, so this also covers "belongs to
 * someone else") just means generation proceeds without it rather than failing the whole request
 * - the bridge only ever adds tailoring on top of the normal profile-grounded generation, so its
 * absence degrades quality, not correctness or safety.
 */
async function fetchBridgeContext(
  supabase: SupabaseServerClient,
  bridgeId: unknown
): Promise<{ confirmedBridge?: ConfirmedBridge; allItems: SkillsBridgeItem[]; bridgeId: string | null }> {
  if (!bridgeId || typeof bridgeId !== "string") {
    return { allItems: [], bridgeId: null };
  }

  const { data: bridge } = await supabase.from("skills_bridges").select("*").eq("id", bridgeId).maybeSingle();
  if (!bridge) {
    console.error("generate-resume: bridgeId provided but not found/owned", bridgeId);
    return { allItems: [], bridgeId: null };
  }
  const bridgeRow = bridge as SkillsBridge;

  const { data: items } = await supabase.from("skills_bridge_items").select("*").eq("bridge_id", bridgeRow.id);
  const allItems = (items ?? []) as SkillsBridgeItem[];

  return { confirmedBridge: buildConfirmedBridge(bridgeRow.mode, allItems), allItems, bridgeId: bridgeRow.id };
}

/**
 * Unlike the skills bridge above, this isn't opt-in per generation via an id the client passes -
 * every confirmed role duty a candidate has ever ticked for a job title automatically applies to
 * any work_experience entry sharing that title (see Phase 1 rationale: fix a role once, benefit
 * every future resume). A profile with no thin roles, or none ever suggested/confirmed, simply
 * yields no rows here, so this is a no-op query for the common case, not an extra round trip that
 * changes behaviour.
 */
async function fetchRoleDutiesContext(
  supabase: SupabaseServerClient,
  userId: string,
  workExperience: WorkExperienceEntry[]
): Promise<ConfirmedRoleDuty[]> {
  const jobTitles = Array.from(
    new Set(workExperience.map((e) => normalize(e.job_title)).filter((title) => title.length > 0))
  );
  if (jobTitles.length === 0) return [];

  const { data: suggestions } = await supabase
    .from("role_duty_suggestions")
    .select("*")
    .eq("user_id", userId)
    .in("job_title", jobTitles);

  const suggestionRows = (suggestions ?? []) as RoleDutySuggestion[];
  if (suggestionRows.length === 0) return [];

  const { data: items } = await supabase
    .from("role_duty_items")
    .select("*")
    .in(
      "suggestion_id",
      suggestionRows.map((s) => s.id)
    )
    .eq("user_state", "confirmed");

  return buildConfirmedRoleDuties(suggestionRows, (items ?? []) as RoleDutyItem[], workExperience);
}

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// A single attempt can legitimately take 35-40s+ at the 55s per-attempt client timeout, so a
// retry needs headroom above ~2x that, not just 60s — 60 wasn't enough and cut off a real,
// in-progress generation (verified in production: request killed mid-flight, quota not refunded
// since the process died before the route's own catch block could run).
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = createClient();
  let reservedForUserId: string | null = null;

  try {
    const { authUserId, appUser } = await requireUser();

    const { jobDescription, jobTitle, companyName, bridgeId } = await request.json();

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    const profileData = profile as UserProfile | null;
    // Normalized once here so every consumer below (generation, fact-check, the quality gate,
    // and the role-duties lookup) sees a role's wins regardless of whether it predates the
    // wins rework - the profile edit form already migrates on load, but that migration is
    // never persisted back to the DB until the user next saves, so a server-side read must
    // apply the same migration itself rather than trusting the stored shape.
    const workExperience = normalizeWorkExperience(profileData?.work_experience);
    const normalizedProfile: UserProfile | null = profileData ? { ...profileData, work_experience: workExperience } : null;

    const missingFields = getMissingMvpFields({
      fullName: appUser.full_name ?? "",
      work_rights: profileData?.work_rights ?? null,
      phone: profileData?.phone ?? null,
      location: profileData?.location ?? null,
      linkedin_url: profileData?.linkedin_url ?? null,
      raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
      skills: profileData?.skills ?? [],
      work_experience: workExperience,
      education: profileData?.education ?? [],
      referees: profileData?.referees ?? [],
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Profile incomplete", missingFields },
        { status: 422 }
      );
    }

    const { confirmedBridge, allItems: bridgeItems, bridgeId: resolvedBridgeId } = await fetchBridgeContext(
      supabase,
      bridgeId
    );
    const confirmedRoleDuties = await fetchRoleDutiesContext(supabase, authUserId, workExperience);

    await reserveResumeGeneration(supabase, appUser);
    reservedForUserId = authUserId;

    const resumeContent = await generateResume({
      jobDescription,
      jobTitle: jobTitle ?? "",
      companyName: companyName ?? "",
      plan: appUser.plan,
      fullName: appUser.full_name ?? "",
      email: appUser.email,
      profile: {
        work_rights: profileData?.work_rights ?? null,
        phone: profileData?.phone ?? null,
        location: profileData?.location ?? null,
        linkedin_url: profileData?.linkedin_url ?? null,
        work_experience: workExperience,
        projects: profileData?.projects ?? [],
        education: profileData?.education ?? [],
        skills: profileData?.skills ?? [],
        referees: profileData?.referees ?? [],
        raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
      },
      confirmedBridge,
      confirmedRoleDuties,
    }, authUserId);

    const factCheckFlags = flagUnverifiedFacts(resumeContent, normalizedProfile, confirmedBridge, confirmedRoleDuties);
    const bridgeFactCheckFlags = flagUnconfirmedBridgeClaims(resumeContent, bridgeItems);

    // Runs after generation, before this insert, so a hard-fail check can mark the resume
    // needs-review before it's ever persisted as "clean". Deterministic only - composes the
    // fact-check flags already computed above rather than re-deriving them, and never edits or
    // invents content itself.
    const gateResult = runQualityGate({
      resume: resumeContent,
      profile: normalizedProfile,
      factCheckFlags,
      bridgeFactCheckFlags,
    });

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: authUserId,
        job_description: jobDescription,
        job_title: jobTitle ?? null,
        company_name: companyName ?? null,
        resume_content: resumeContent,
        template: "ats-safe",
        fact_check_flags: factCheckFlags,
        bridge_fact_check_flags: bridgeFactCheckFlags,
        skills_bridge_id: resolvedBridgeId,
        gate_result: gateResult,
      })
      .select()
      .single();

    if (insertError) {
      await refundResumeGeneration(supabase, reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await saveVersionSnapshot(supabase, resume.id, resumeContent, "Initial generation");

    return NextResponse.json({ resume });
  } catch (error) {
    if (reservedForUserId) {
      await refundResumeGeneration(supabase, reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeLimitReachedError) {
      return NextResponse.json(
        {
          error: "Free resume limit reached",
          code: "FREE_LIMIT_REACHED",
          limit: FREE_RESUME_LIMIT,
        },
        { status: 403 }
      );
    }
    console.error("generate-resume error", error);
    return NextResponse.json({ error: "Failed to generate resume" }, { status: 500 });
  }
}
