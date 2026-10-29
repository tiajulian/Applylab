import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { findSourceExperience, normalize } from "@/lib/resume/factCheck";
import { validateStringList } from "@/lib/text/validateStringList";
import type { BridgeItemUserState, UserProfile } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const MAX_NOTE_LENGTH = 2000;
// "pending" is the undo transition (confirmed back to unconfirmed) - same route, same ownership
// check, same partial update as confirm/reject, just a third allowed value.
const ALLOWED_USER_STATES: BridgeItemUserState[] = ["confirmed", "rejected", "pending"];

export async function PATCH(
  request: Request,
  props: { params: Promise<{ bridgeId: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const { authUserId } = await requireUser();

    const body = await request.json();
    const {
      user_state: userState,
      user_note: userNote,
      source_company: sourceCompany,
      source_job_title: sourceJobTitle,
      save_to_profile: saveToProfile,
      reset_to_gap: resetToGap,
      tools: rawTools,
      stakeholders: rawStakeholders,
      expected_user_state: expectedUserState,
      expected_user_note: expectedUserNote,
      expected_source: expectedSource,
    } = body ?? {};
    const conditional = expectedUserState !== undefined || expectedUserNote !== undefined;
    if (expectedSource !== undefined && (!conditional || !expectedSource || typeof expectedSource !== "object"
      || !["matched", "to_confirm", "gap"].includes(expectedSource.state)
      || typeof expectedSource.company !== "string" || typeof expectedSource.job_title !== "string"
      || expectedSource.company.length > 1000 || expectedSource.job_title.length > 1000)) {
      return NextResponse.json({ error: "Reload the skill question before saving." }, { status: 400 });
    }
    if (conditional && (sourceCompany !== undefined || sourceJobTitle !== undefined || saveToProfile || resetToGap || rawTools !== undefined || rawStakeholders !== undefined)) {
      return NextResponse.json({ error: "Save the answer separately from changes to its source or profile." }, { status: 400 });
    }
    if (conditional && (!ALLOWED_USER_STATES.includes(expectedUserState) || (expectedUserNote !== null && (typeof expectedUserNote !== "string" || expectedUserNote.length > MAX_NOTE_LENGTH)))) {
      return NextResponse.json({ error: "Reload the skill question before saving." }, { status: 400 });
    }
    if (conditional && userState === "confirmed" && (typeof userNote !== "string" || !userNote.trim())) {
      return NextResponse.json({ error: "Add a short example of what you actually did first." }, { status: 400 });
    }
    // The candidate's own picks: a malformed list is rejected, never quietly emptied or cut short.
    const toolsResult = rawTools === undefined ? undefined : validateStringList(rawTools, "tools");
    const stakeholdersResult = rawStakeholders === undefined ? undefined : validateStringList(rawStakeholders, "stakeholders");
    if (toolsResult && !toolsResult.ok) return NextResponse.json({ error: toolsResult.error }, { status: 400 });
    if (stakeholdersResult && !stakeholdersResult.ok) {
      return NextResponse.json({ error: stakeholdersResult.error }, { status: 400 });
    }
    const tools = toolsResult?.value;
    const stakeholders = stakeholdersResult?.value;

    if (userState !== undefined && !ALLOWED_USER_STATES.includes(userState)) {
      return NextResponse.json(
        { error: "user_state must be 'confirmed', 'rejected', or 'pending'" },
        { status: 400 }
      );
    }
    if (userNote !== undefined && userNote !== null) {
      if (typeof userNote !== "string" || userNote.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { error: `user_note must be a string of ${MAX_NOTE_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
    }
    if (
      userState === undefined &&
      userNote === undefined &&
      sourceCompany === undefined &&
      sourceJobTitle === undefined &&
      tools === undefined &&
      stakeholders === undefined
    ) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = createClient();
    const serviceSupabase = createServiceRoleClient();

    // Verify ownership of the bridge
    const { data: bridge, error: bridgeError } = await supabase
      .from("skills_bridges")
      .select("id, user_id")
      .eq("id", params.bridgeId)
      .eq("user_id", authUserId)
      .maybeSingle();

    if (bridgeError || !bridge) {
      return NextResponse.json({ error: "Skill gap check not found" }, { status: 404 });
    }

    // Fetch existing item
    const { data: existing, error: fetchError } = await serviceSupabase
      .from("skills_bridge_items")
      .select("*")
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    if (expectedSource && (existing.state !== expectedSource.state || existing.source_company !== expectedSource.company || existing.source_job_title !== expectedSource.job_title)) {
      return NextResponse.json({ error: "The role for this answer changed in another tab. Your answer has not been saved. Reload before trying again." }, { status: 409 });
    }

    // Picks belong to items the candidate answers or claims - never a matched item, whose evidence
    // is already their own words.
    if ((tools !== undefined || stakeholders !== undefined) && existing.state === "matched") {
      return NextResponse.json({ error: "Tools and people can't be added to a matched skill" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (tools !== undefined) updates.tools = tools;
    if (stakeholders !== undefined) updates.stakeholders = stakeholders;

    // Handling gap claim:
    // If the item is currently a gap (or was converted from a gap with empty source_snippet),
    // confirming it requires attaching it to a real work experience role from the candidate's profile.
    if (userState === "confirmed" && (existing.state === "gap" || (!existing.source_company && !sourceCompany))) {
      if (!sourceCompany || typeof sourceCompany !== "string" || !sourceJobTitle || typeof sourceJobTitle !== "string") {
        return NextResponse.json(
          { error: "Please select a role from your work experience to claim this skill." },
          { status: 400 }
        );
      }

      // Fetch user profile to verify role exists in their real work history
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUserId)
        .maybeSingle();

      const profileData = profile as UserProfile | null;
      const matchedSource = findSourceExperience(
        { company: sourceCompany, job_title: sourceJobTitle },
        profileData?.work_experience ?? [],
        -1
      );

      if (!matchedSource) {
        return NextResponse.json(
          { error: "Selected role not found in your work history." },
          { status: 400 }
        );
      }

      updates.source_company = matchedSource.company;
      updates.source_job_title = matchedSource.job_title;
      updates.state = "to_confirm";
      updates.user_state = "confirmed";
      if (userNote !== undefined) updates.user_note = userNote;

      // Optionally sync to user's profile work history
      if (saveToProfile && profileData && profileData.work_experience) {
        const updatedExperience = profileData.work_experience.map((role) => {
          if (
            normalize(role.company) === normalize(matchedSource.company) &&
            normalize(role.job_title) === normalize(matchedSource.job_title)
          ) {
            const winText = userNote?.trim()
              ? `${existing.competency}: ${userNote.trim()}`
              : existing.competency;

            const currentWins = role.wins ?? [];
            const existingIndex = currentWins.findIndex((w) => normalize(w.text ?? "") === normalize(winText));

            // Same win claimed again: merge in any newly picked tools/people rather than dropping them.
            if (existingIndex !== -1) {
              if (!tools?.length && !stakeholders?.length) return role;
              const merge = (a: string[] | undefined, b: string[] | undefined) =>
                Array.from(new Map([...(a ?? []), ...(b ?? [])].map((v) => [v.toLowerCase(), v])).values()).slice(0, 20);
              const existingWin = currentWins[existingIndex];
              return {
                ...role,
                wins: currentWins.map((w, i) =>
                  i === existingIndex
                    ? { ...existingWin, tools: merge(existingWin.tools, tools), stakeholders: merge(existingWin.stakeholders, stakeholders) }
                    : w
                ),
              };
            }

            return {
              ...role,
              wins: [
                ...currentWins,
                {
                  text: winText,
                  ...(tools && tools.length > 0 ? { tools } : {}),
                  ...(stakeholders && stakeholders.length > 0 ? { stakeholders } : {}),
                },
              ],
            };
          }
          return role;
        });

        await serviceSupabase
          .from("user_profiles")
          .update({
            work_experience: updatedExperience,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", authUserId);
      }
    } else if (userState === "pending" && resetToGap) {
      // Reverting an undone gap item back to gap state
      updates.user_state = "pending";
      updates.state = "gap";
      updates.source_company = "";
      updates.source_job_title = "";
      // The picks belonged to the claim being undone.
      updates.tools = [];
      updates.stakeholders = [];
      if (userNote !== undefined) updates.user_note = userNote;
    } else {
      if (userState !== undefined) updates.user_state = userState;
      if (userNote !== undefined) updates.user_note = userNote;
      if (sourceCompany !== undefined) updates.source_company = sourceCompany;
      if (sourceJobTitle !== undefined) updates.source_job_title = sourceJobTitle;
    }

    let updateQuery = serviceSupabase
      .from("skills_bridge_items")
      .update(updates)
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId);
    if (conditional) {
      updateQuery = updateQuery.eq("user_state", expectedUserState).eq("state", existing.state)
        .eq("source_company", existing.source_company).eq("source_job_title", existing.source_job_title);
      updateQuery = expectedUserNote === null ? updateQuery.is("user_note", null) : updateQuery.eq("user_note", expectedUserNote);
    }
    const { data: item, error } = await updateQuery.select().maybeSingle();

    if (!error && !item && conditional) {
      return NextResponse.json({ error: "This answer changed in another tab. Reload the page before saving again." }, { status: 409 });
    }

    if (error || !item) {
      return NextResponse.json({ error: "Couldn't update this skill" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("skills-bridge item update error", error);
    return NextResponse.json({ error: "Couldn't update this skill" }, { status: 500 });
  }
}

