import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { sanitizeDashes, sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { normalizeWorkExperience } from "@/lib/profile/normalizeWorkExperience";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import {
  buildConfirmedBridge,
  findSourceExperience,
  findSourceProject,
  flagUnconfirmedBridgeClaims,
  flagUnverifiedFacts,
} from "@/lib/resume/factCheck";
import { fetchBridgeItemsById } from "@/lib/resume/fetchBridgeItems";
import { fetchRoleDutiesContext } from "@/lib/resume/fetchConfirmedRoleDuties";
import { runQualityGate } from "@/lib/resume/qualityGate";
import { applyFix, isAlignResolution, type ClientFixResolution, type FixResolution } from "@/lib/resume/applyFix";
import type { BridgeMode, ConfirmedBridge, Resume, ResumeContent, SkillsBridgeItem, UserProfile } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const MAX_NOTE_LENGTH = 2000;
const MAX_BULLET_TEXT_LENGTH = 2000;
// Same bound as app/api/profile/route.ts's MAX_LINKEDIN_PASTE_LEN - captureEvidence appends to
// the same column, so it must respect the same cap.
const MAX_LINKEDIN_PASTE_LEN = 50_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Validates and narrows an arbitrary request body's `resolution` object into a ClientFixResolution
 * - the shape a client is allowed to send (see lib/resume/applyFix.ts for why the four "align"
 * kinds omit their value(s) here). Returns null for anything malformed, out-of-shape, or unknown.
 */
function parseClientResolution(input: Record<string, unknown>): ClientFixResolution | null {
  const index = input.index;
  const bulletIndex = input.bulletIndex;
  const hasIndex = isNonNegativeInt(index);
  const hasBulletIndex = isNonNegativeInt(bulletIndex);

  switch (input.kind) {
    case "removeExperience":
    case "removeProject":
    case "removeReferee":
    case "removeSkill":
    case "removeTool":
      return hasIndex ? { kind: input.kind, index: index as number } : null;

    case "removeSummaryPhrase":
      return typeof input.phrase === "string" && input.phrase.length > 0
        ? { kind: "removeSummaryPhrase", phrase: input.phrase }
        : null;

    case "removeExperienceBullet":
    case "removeProjectBullet":
      return hasIndex && hasBulletIndex
        ? { kind: input.kind, index: index as number, bulletIndex: bulletIndex as number }
        : null;

    case "replaceExperienceBullet":
    case "replaceProjectBullet":
      return hasIndex &&
        hasBulletIndex &&
        typeof input.text === "string" &&
        input.text.trim().length > 0 &&
        input.text.length <= MAX_BULLET_TEXT_LENGTH
        ? { kind: input.kind, index: index as number, bulletIndex: bulletIndex as number, text: input.text }
        : null;

    case "alignExperienceField":
      return hasIndex && (input.field === "company" || input.field === "job_title")
        ? { kind: "alignExperienceField", index: index as number, field: input.field }
        : null;

    case "alignExperienceDates":
      return hasIndex ? { kind: "alignExperienceDates", index: index as number } : null;

    case "alignProjectTitle":
      return hasIndex ? { kind: "alignProjectTitle", index: index as number } : null;

    case "alignProjectYear":
      return hasIndex ? { kind: "alignProjectYear", index: index as number } : null;

    case "alignEducationField":
      return hasIndex && (input.field === "degree" || input.field === "institution")
        ? { kind: "alignEducationField", index: index as number, field: input.field }
        : null;

    default:
      return null;
  }
}

/** Array-bounds check, run before applyFix - out-of-range indices must 400, never throw inside
 * the pure applyFix transform. */
function validateBounds(resolution: ClientFixResolution, content: ResumeContent): string | null {
  switch (resolution.kind) {
    case "removeExperience":
    case "alignExperienceField":
    case "alignExperienceDates":
      return content.experience[resolution.index] ? null : "Invalid experience index";
    case "removeExperienceBullet":
    case "replaceExperienceBullet":
      return content.experience[resolution.index]?.bullets[resolution.bulletIndex] !== undefined
        ? null
        : "Invalid experience bullet index";
    case "removeProject":
    case "alignProjectTitle":
    case "alignProjectYear":
      return content.projects[resolution.index] ? null : "Invalid project index";
    case "removeProjectBullet":
    case "replaceProjectBullet":
      return content.projects[resolution.index]?.bullets[resolution.bulletIndex] !== undefined
        ? null
        : "Invalid project bullet index";
    case "removeReferee":
      return content.referees[resolution.index] ? null : "Invalid referee index";
    case "removeSkill":
      return content.skills[resolution.index] !== undefined ? null : "Invalid skill index";
    case "removeTool":
      return content.tools[resolution.index] !== undefined ? null : "Invalid tool index";
    case "alignEducationField":
      return content.education[resolution.index] ? null : "Invalid education index";
    case "removeSummaryPhrase":
      return null;
  }
}

/**
 * Resolves a client's "align" request into the value-bearing FixResolution applyFix needs, always
 * reading the real value from the profile itself - never from the client. Returns null when there
 * is genuinely nothing to align to (e.g. the matched source vanished since the flag was computed),
 * in which case the route 400s rather than guessing.
 */
function resolveAlignment(
  resolution: ClientFixResolution,
  content: ResumeContent,
  profile: UserProfile | null
): FixResolution | null {
  switch (resolution.kind) {
    case "alignExperienceField": {
      const entry = content.experience[resolution.index];
      const source = entry && findSourceExperience(entry, profile?.work_experience ?? [], resolution.index);
      if (!source) return null;
      const value = resolution.field === "company" ? source.company : source.job_title;
      return { kind: "alignExperienceField", index: resolution.index, field: resolution.field, value };
    }
    case "alignExperienceDates": {
      const entry = content.experience[resolution.index];
      const source = entry && findSourceExperience(entry, profile?.work_experience ?? [], resolution.index);
      if (!source) return null;
      return {
        kind: "alignExperienceDates",
        index: resolution.index,
        start_date: source.start_date,
        end_date: source.end_date,
      };
    }
    case "alignProjectTitle": {
      const entry = content.projects[resolution.index];
      const source = entry && findSourceProject(entry, profile?.projects ?? [], resolution.index);
      if (!source) return null;
      return { kind: "alignProjectTitle", index: resolution.index, value: source.title };
    }
    case "alignProjectYear": {
      const entry = content.projects[resolution.index];
      const source = entry && findSourceProject(entry, profile?.projects ?? [], resolution.index);
      if (!source) return null;
      return { kind: "alignProjectYear", index: resolution.index, value: source.timeframe };
    }
    case "alignEducationField": {
      const source = profile?.education?.[resolution.index];
      if (!source) return null;
      return { kind: "alignEducationField", index: resolution.index, field: resolution.field, value: source[resolution.field] };
    }
    default:
      return null;
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const body = await request.json();
    if (!isPlainObject(body) || !isPlainObject(body.resolution) || typeof body.resolution.kind !== "string") {
      return NextResponse.json({ error: "resolution is required" }, { status: 400 });
    }
    const resolutionInput = body.resolution as Record<string, unknown>;

    const { data: resumeRow, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !resumeRow) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const resume = resumeRow as Resume;
    if (!resume.resume_content) {
      return NextResponse.json({ error: "Resume has no content to fix" }, { status: 400 });
    }
    const currentContent = sanitizeResumeContent(resume.resume_content);

    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();
    const profileData = profileRow as UserProfile | null;
    // Normalized the same way generate-resume/route.ts does - a fix's re-check must see the same
    // shape generation-time fact-checking sees, or it could silently pass/fail differently.
    const workExperience = normalizeWorkExperience(profileData?.work_experience);
    let normalizedProfile: UserProfile | null = profileData
      ? { ...profileData, work_experience: workExperience }
      : null;

    let allItems: SkillsBridgeItem[] = [];
    let confirmedBridge: ConfirmedBridge | undefined;
    if (resume.skills_bridge_id) {
      allItems = await fetchBridgeItemsById(supabase, resume.skills_bridge_id);
      const { data: bridgeRow } = await supabase
        .from("skills_bridges")
        .select("mode")
        .eq("id", resume.skills_bridge_id)
        .maybeSingle();
      if (bridgeRow) {
        confirmedBridge = buildConfirmedBridge((bridgeRow as { mode: BridgeMode }).mode, allItems);
      }
    }

    const confirmedRoleDuties = await fetchRoleDutiesContext(supabase, authUserId, workExperience);

    let nextContent: ResumeContent = currentContent;

    if (resolutionInput.kind === "recheck") {
      // No mutation at all - used after the client separately PATCHes a Skills Bridge item's
      // confirm route, purely to refresh flags/gate_result against the now-confirmed item.
    } else if (resolutionInput.kind === "captureEvidence") {
      const noteRaw = resolutionInput.note;
      if (typeof noteRaw !== "string" || !noteRaw.trim()) {
        return NextResponse.json({ error: "note is required" }, { status: 400 });
      }
      if (noteRaw.length > MAX_NOTE_LENGTH) {
        return NextResponse.json({ error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` }, { status: 400 });
      }

      const sanitizedNote = sanitizeDashes(noteRaw.trim());
      const existingPaste = profileData?.raw_linkedin_paste ?? "";
      const combinedPaste = existingPaste ? `${existingPaste}\n\n${sanitizedNote}` : sanitizedNote;
      const updatedPaste = combinedPaste.slice(0, MAX_LINKEDIN_PASTE_LEN);

      const { error: profileUpdateError } = await supabase
        .from("user_profiles")
        .update({ raw_linkedin_paste: updatedPaste, updated_at: new Date().toISOString() })
        .eq("user_id", authUserId);

      if (profileUpdateError) {
        console.error("resume-fix: failed to save captured evidence", profileUpdateError);
        return NextResponse.json({ error: "Failed to save evidence" }, { status: 500 });
      }

      // Re-check below must see the fresh evidence, not the pre-update snapshot already loaded.
      normalizedProfile = normalizedProfile ? { ...normalizedProfile, raw_linkedin_paste: updatedPaste } : normalizedProfile;
    } else {
      const clientResolution = parseClientResolution(resolutionInput);
      if (!clientResolution) {
        return NextResponse.json({ error: "Invalid resolution" }, { status: 400 });
      }

      const boundsError = validateBounds(clientResolution, currentContent);
      if (boundsError) {
        return NextResponse.json({ error: boundsError }, { status: 400 });
      }

      let resolution: FixResolution;
      if (isAlignResolution(clientResolution)) {
        const resolved = resolveAlignment(clientResolution, currentContent, normalizedProfile);
        if (!resolved) {
          return NextResponse.json({ error: "No matching profile entry found to align to" }, { status: 400 });
        }
        resolution = resolved;
      } else {
        resolution = clientResolution;
      }

      nextContent = sanitizeDeep(applyFix(currentContent, resolution));
    }

    // Snapshot the pre-fix state before persisting a real content change, so a future "restore"
    // brings back what the resume looked like immediately before this fix - same pattern as
    // app/api/resume/[id]/versions/[versionId]/restore/route.ts snapshotting current content
    // right before overwriting it. Reference inequality is fine: applyFix always returns a new
    // object, and the recheck/captureEvidence branches above never reassign nextContent.
    if (nextContent !== currentContent) {
      await saveVersionSnapshot(supabase, resume.id, currentContent, "Before honesty fix");
    }

    const factCheckFlags = flagUnverifiedFacts(nextContent, normalizedProfile, confirmedBridge, confirmedRoleDuties);
    const bridgeFactCheckFlags = flagUnconfirmedBridgeClaims(nextContent, allItems);
    const gateResult = runQualityGate({
      resume: nextContent,
      profile: normalizedProfile,
      factCheckFlags,
      bridgeFactCheckFlags,
    });

    const { data: updated, error: updateError } = await supabase
      .from("resumes")
      .update({
        resume_content: nextContent,
        fact_check_flags: factCheckFlags,
        bridge_fact_check_flags: bridgeFactCheckFlags,
        gate_result: gateResult,
      })
      .eq("id", resume.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? "Failed to apply fix" }, { status: 500 });
    }

    return NextResponse.json({ resume: updated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("resume-fix error", error);
    return NextResponse.json({ error: "Failed to apply fix" }, { status: 500 });
  }
}
