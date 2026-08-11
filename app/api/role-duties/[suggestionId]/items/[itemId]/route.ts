import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { RoleDutyItemUserState } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const ALLOWED_USER_STATES: RoleDutyItemUserState[] = ["confirmed", "rejected"];
const MAX_DUTY_TEXT_LENGTH = 500;
const MAX_OUTCOME_LENGTH = 500;

export async function PATCH(
  request: Request,
  { params }: { params: { suggestionId: string; itemId: string } }
) {
  try {
    await requireUser();

    const body = await request.json();
    const {
      user_state: userState,
      user_edited_text: userEditedText,
      outcome_text: outcomeText,
      outcome_metric: outcomeMetric,
    } = body ?? {};

    const update: {
      user_state?: RoleDutyItemUserState;
      user_edited_text?: string | null;
      outcome_text?: string | null;
      outcome_metric?: string | null;
    } = {};

    if (userState !== undefined) {
      if (!ALLOWED_USER_STATES.includes(userState)) {
        return NextResponse.json(
          { error: "user_state must be 'confirmed' or 'rejected'" },
          { status: 400 }
        );
      }
      update.user_state = userState;
    }

    if (userEditedText !== undefined && userEditedText !== null) {
      if (typeof userEditedText !== "string" || !userEditedText.trim()) {
        return NextResponse.json({ error: "user_edited_text must be a non-empty string" }, { status: 400 });
      }
      if (userEditedText.length > MAX_DUTY_TEXT_LENGTH) {
        return NextResponse.json(
          { error: `user_edited_text must be ${MAX_DUTY_TEXT_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      update.user_edited_text = userEditedText.trim();
    } else if (userEditedText === null) {
      // Resets the item back to the original AI-suggested wording (see "Reset to suggestion" in
      // RoleDutiesReview.tsx), same clear-to-null convention as skills_bridge_items.user_note.
      update.user_edited_text = null;
    }

    if (outcomeText !== undefined) {
      if (outcomeText !== null && typeof outcomeText !== "string") {
        return NextResponse.json({ error: "outcome_text must be a string or null" }, { status: 400 });
      }
      const trimmed = typeof outcomeText === "string" ? sanitizeDeep(outcomeText.trim()) : null;
      if (trimmed && trimmed.length > MAX_OUTCOME_LENGTH) {
        return NextResponse.json(
          { error: `outcome_text must be ${MAX_OUTCOME_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      update.outcome_text = trimmed || null;
    }

    if (outcomeMetric !== undefined) {
      if (outcomeMetric !== null && typeof outcomeMetric !== "string") {
        return NextResponse.json({ error: "outcome_metric must be a string or null" }, { status: 400 });
      }
      const trimmed = typeof outcomeMetric === "string" ? sanitizeDeep(outcomeMetric.trim()) : null;
      if (trimmed && trimmed.length > MAX_OUTCOME_LENGTH) {
        return NextResponse.json(
          { error: `outcome_metric must be ${MAX_OUTCOME_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      update.outcome_metric = trimmed || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "user_state, user_edited_text, outcome_text, and/or outcome_metric is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Scoped by both item id and suggestion_id (guards against an item that belongs to a
    // different suggestion) - RLS additionally scopes by ownership via the
    // role_duty_suggestions join, so a request for someone else's item simply matches zero rows
    // rather than erroring, which is why a missing result means "not found", not "forbidden".
    const { data: item, error } = await supabase
      .from("role_duty_items")
      .update(update)
      .eq("id", params.itemId)
      .eq("suggestion_id", params.suggestionId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json({ error: "Role duty item not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("role-duties item update error", error);
    return NextResponse.json({ error: "Failed to update role duty item" }, { status: 500 });
  }
}
