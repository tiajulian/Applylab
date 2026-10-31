import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateResume } from "@/lib/anthropic/generateResume";
import {
  FREE_RESUME_LIMIT,
  FreeLimitReachedError,
  refundResumeGeneration,
  requirePermanentUser,
  reserveResumeGeneration,
  markFreeAllowanceResume,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/requireUser";
import { getMissingMvpFields } from "@/lib/profile/completeness";
import { normalizeProfile } from "@/lib/profile/normalizeProfile";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import {
  buildConfirmedBridge,
  flagUnconfirmedBridgeClaims,
  flagUnverifiedFacts,
  pruneUnsupportedSkillsAndTools,
  stripCrossRoleTools,
} from "@/lib/resume/factCheck";
import { fetchBridgeItemsById } from "@/lib/resume/fetchBridgeItems";
import { fetchRoleDutiesContext } from "@/lib/resume/fetchConfirmedRoleDuties";
import { runQualityGate } from "@/lib/resume/qualityGate";
import { summaryTargetTitle } from "@/lib/resume/relevantExperience";
import { GENERAL_RESUME_TITLE } from "@/lib/resume/generalResume";
import { hasResumeContent, importedProfileToUserProfile, uploadedResumeContent } from "@/lib/resume/importedProfile";
import { addUploadToProfile } from "@/lib/resume/addUploadToProfile";
import { canonicalTemplate } from "@/lib/resume/templateMetadata";
import type { ConfirmedBridge, FactCheckFlag, ResumeContent, SkillsBridge, SkillsBridgeItem, UserProfile } from "@/types";
import { safeHttpUrl } from "@/lib/url/safeHttpUrl";


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

  const allItems = await fetchBridgeItemsById(supabase, bridgeRow.id);

  return { confirmedBridge: buildConfirmedBridge(bridgeRow.mode, allItems), allItems, bridgeId: bridgeRow.id };
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
  let releaseSlot: (() => Promise<void>) | null = null;

  try {
    const { authUserId, appUser } = await requirePermanentUser();

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "generate-resume", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;
    const rateLimited = await enforceRateLimit(`generate-resume:${authUserId}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;


    const body = await request.json();
    const { jobTitle, companyName, bridgeId, template } = body;
    // Explicit opt-in (never inferred from a missing jobDescription), so a client bug that drops
    // the ad can't silently spend a generation on a generic resume.
    const isGeneral = body.mode === "general";
    const jobDescription: string = isGeneral ? "" : body.jobDescription;

    // Trimmed: generateResume treats a blank ad as a general resume, so a whitespace-only ad must
    // be rejected here rather than silently switching modes.
    if (!isGeneral && (typeof jobDescription !== "string" || !jobDescription.trim())) {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }

    const chosenTemplate = canonicalTemplate(template);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    // "upload": written from a resume file the user just uploaded (parsed by /api/profile/parse)
    // in place of the saved profile, which takes whatever new details the file adds once the
    // resume is saved (addUploadToProfile). Works with or without a job ad.
    const imported =
      body.source === "upload"
        ? importedProfileToUserProfile(body.importedProfile, profile as UserProfile | null, authUserId)
        : null;
    const profileData = imported?.profile ?? (profile as UserProfile | null);
    const fullName = imported?.fullName || appUser.full_name || "";
    // Normalized (wins/is_current/legacy education dates) and work_experience sorted most-recent-
    // first once here, so every consumer below (generation, fact-check, the quality gate, and the
    // role-duties lookup) sees the same migrated, ordered data - see normalizeProfile.ts.
    const { workExperience, education, normalizedProfile } = normalizeProfile(profileData);

    const candidateProjects = (profileData?.projects ?? []).filter((proj) => proj.title?.trim());

    if (imported && !hasResumeContent(imported.profile)) {
      return NextResponse.json(
        { error: "We couldn't find any experience, education or skills in that file." },
        { status: 422 }
      );
    }

    // An upload is written from whatever the file holds, so it isn't held to the profile minimum.
    const missingFields = imported
      ? []
      : getMissingMvpFields({
          fullName,
          work_rights: profileData?.work_rights ?? null,
          phone: profileData?.phone ?? null,
          location: profileData?.location ?? null,
          linkedin_url: profileData?.linkedin_url ?? null,
          portfolio_url: profileData?.portfolio_url ?? null,
          github_url: profileData?.github_url ?? null,
          raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
          skills: profileData?.skills ?? [],
          work_experience: workExperience,
          education,
          referees: profileData?.referees ?? [],
        });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Profile incomplete", missingFields },
        { status: 422 }
      );
    }

    // A general resume has no job ad to bridge to, so any bridgeId is ignored.
    const { confirmedBridge, allItems: bridgeItems, bridgeId: resolvedBridgeId } = await fetchBridgeContext(
      supabase,
      isGeneral ? null : bridgeId
    );
    // Confirmed duties belong to the saved profile's roles, so an upload doesn't borrow them.
    const confirmedRoleDuties = imported ? [] : await fetchRoleDutiesContext(supabase, authUserId, workExperience);

    await reserveResumeGeneration(supabase, appUser);
    reservedForUserId = authUserId;

    // A general resume from an upload opens exactly as the file wrote it - no rewrite, no pruning,
    // and nothing to fact-check or gate since the file is the source; the editor's reviewer
    // suggests changes instead. A tailored one is still written for its ad.
    const keepAsWritten = Boolean(imported) && isGeneral;
    let resumeContent: ResumeContent;
    let factCheckFlags: FactCheckFlag[] = [];
    let bridgeFactCheckFlags: FactCheckFlag[] = [];
    if (keepAsWritten) {
      resumeContent = uploadedResumeContent(body.importedProfile, {
        name: fullName,
        email: appUser.email,
        phone: profileData?.phone ?? "",
        location: profileData?.location ?? "",
        linkedin: profileData?.linkedin_url ?? "",
        portfolio: profileData?.portfolio_url ?? "",
        github: profileData?.github_url ?? "",
        work_rights: profileData?.work_rights ?? "",
      });
    } else {
      const generatedContent = await generateResume({
        jobDescription,
        jobTitle: isGeneral ? "" : jobTitle ?? "",
        companyName: isGeneral ? "" : companyName ?? "",
        plan: appUser.plan,
        fullName,
        email: appUser.email,
        profile: {
          career_goal: profileData?.career_goal ?? null,
          target_role: profileData?.target_role ?? null,
          job_hunt_pain: profileData?.job_hunt_pain ?? null,
          work_rights: profileData?.work_rights ?? null,
          phone: profileData?.phone ?? null,
          location: profileData?.location ?? null,
          linkedin_url: profileData?.linkedin_url ?? null,
          portfolio_url: profileData?.portfolio_url ?? null,
          github_url: profileData?.github_url ?? null,
          work_experience: workExperience,
          projects: candidateProjects,
          education,
          skills: profileData?.skills ?? [],
          referees: profileData?.referees ?? [],
          raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
        },
        confirmedBridge,
        confirmedRoleDuties,
      }, authUserId, supabase);

      // Deterministic backstops for the prompt's grounding rules, applied before anything is saved:
      // a Key Skill or tool that doesn't trace to the profile (usually lifted from the job ad) is
      // dropped, and a tool given for one role is cut from another role's "using X" phrase. What
      // can't be removed cleanly is still flagged by flagUnverifiedFacts below.
      resumeContent = pruneUnsupportedSkillsAndTools(
        stripCrossRoleTools(generatedContent, normalizedProfile, confirmedBridge, confirmedRoleDuties),
        normalizedProfile,
        confirmedBridge,
        confirmedRoleDuties
      );

      factCheckFlags = flagUnverifiedFacts(resumeContent, normalizedProfile, confirmedBridge, confirmedRoleDuties);
      bridgeFactCheckFlags = flagUnconfirmedBridgeClaims(resumeContent, bridgeItems);
    }

    // Runs after generation, before this insert, so a hard-fail check can mark the resume
    // needs-review before it's ever persisted as "clean". Deterministic only - composes the
    // fact-check flags already computed above rather than re-deriving them, and never edits or
    // invents content itself. Its checks compare the writing against the user's facts, so a resume
    // kept as the user wrote it (the facts themselves) has nothing to check.
    const gateResult = keepAsWritten
      ? null
      : runQualityGate({
          resume: resumeContent,
          profile: normalizedProfile,
          factCheckFlags,
          bridgeFactCheckFlags,
          targetTitle: summaryTargetTitle(isGeneral ? "" : jobTitle, workExperience),
        });

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: authUserId,
        job_description: jobDescription,
        // Labels the resume in the dashboard/interview lists, which otherwise fall back to
        // "Tailored Resume" / "Untitled role".
        job_title: isGeneral ? GENERAL_RESUME_TITLE : jobTitle ?? null,
        company_name: isGeneral ? null : companyName ?? null,
        // Set when the resume was made from a Find jobs listing ("Apply for this job" in the editor).
        job_url: isGeneral ? null : safeHttpUrl(body.jobUrl),
        resume_content: resumeContent,
        template: chosenTemplate,
        fact_check_flags: factCheckFlags,
        bridge_fact_check_flags: bridgeFactCheckFlags,
        skills_bridge_id: resolvedBridgeId,
        gate_result: gateResult,
      })
      .select()
      .single();


    if (insertError) {
      await refundResumeGeneration(reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (imported) await addUploadToProfile(supabase, appUser, profile as UserProfile | null, imported);

    // A free user's resume made within FREE_RESUME_LIMIT is theirs to download.
    await markFreeAllowanceResume(appUser, resume.id);
    await saveVersionSnapshot(supabase, resume.id, resumeContent, "Initial generation");

    return NextResponse.json({ resume });
  } catch (error) {
    if (reservedForUserId) {
      await refundResumeGeneration(reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
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
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("generate-resume error", error);
    return NextResponse.json({ error: "Failed to generate resume" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
