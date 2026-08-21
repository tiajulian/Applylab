import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { findSourceExperience, normalize } from "@/lib/resume/factCheck";
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
  { params }: { params: { bridgeId: string; itemId: string } }
) {
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
    } = body ?? {};

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
      sourceJobTitle === undefined
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
      return NextResponse.json({ error: "Skills bridge not found" }, { status: 404 });
    }

    // Fetch existing item
    const { data: existing, error: fetchError } = await serviceSupabase
      .from("skills_bridge_items")
      .select("*")
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Skills bridge item not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

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
            const alreadyExists = currentWins.some(
              (w) => normalize(w.text ?? "") === normalize(winText)
            );

            if (!alreadyExists) {
              return {
                ...role,
                wins: [...currentWins, { text: winText }],
              };
            }
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
      if (userNote !== undefined) updates.user_note = userNote;
    } else {
      if (userState !== undefined) updates.user_state = userState;
      if (userNote !== undefined) updates.user_note = userNote;
      if (sourceCompany !== undefined) updates.source_company = sourceCompany;
      if (sourceJobTitle !== undefined) updates.source_job_title = sourceJobTitle;
    }

    const { data: item, error } = await serviceSupabase
      .from("skills_bridge_items")
      .update(updates)
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json({ error: "Failed to update skills bridge item" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("skills-bridge item update error", error);
    return NextResponse.json({ error: "Failed to update skills bridge item" }, { status: 500 });
  }
}

