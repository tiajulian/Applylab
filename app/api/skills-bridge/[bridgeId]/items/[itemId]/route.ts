import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { BridgeItemUserState } from "@/types";

const MAX_NOTE_LENGTH = 2000;
const ALLOWED_USER_STATES: BridgeItemUserState[] = ["confirmed", "rejected"];

export async function PATCH(
  request: Request,
  { params }: { params: { bridgeId: string; itemId: string } }
) {
  try {
    await requireUser();

    const body = await request.json();
    const { user_state: userState, user_note: userNote } = body ?? {};

    if (userState !== undefined && !ALLOWED_USER_STATES.includes(userState)) {
      return NextResponse.json(
        { error: "user_state must be 'confirmed' or 'rejected'" },
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
    if (userState === undefined && userNote === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = createClient();

    // Scoped by both item id and bridge_id (guards against an item that belongs to a different
    // bridge, same as the resume/version-restore pattern) - RLS additionally scopes by ownership
    // via the skills_bridges join, so a request for someone else's item simply matches zero rows
    // rather than erroring, which is why a missing result means "not found", not "forbidden".
    const { data: existing, error: fetchError } = await supabase
      .from("skills_bridge_items")
      .select("*")
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Skills bridge item not found" }, { status: 404 });
    }

    // Hard invariant, not just a UI nicety: a `gap` item must never become a resume claim, so it
    // can never be confirmed, no matter what a client sends. Notes are still fine (see the gap
    // card's "note it for yourself" options in the UI), only the confirm transition is blocked.
    if (userState === "confirmed" && existing.state === "gap") {
      return NextResponse.json({ error: "A gap item can't be confirmed" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (userState !== undefined) updates.user_state = userState;
    if (userNote !== undefined) updates.user_note = userNote;

    const { data: item, error } = await supabase
      .from("skills_bridge_items")
      .update(updates)
      .eq("id", params.itemId)
      .eq("bridge_id", params.bridgeId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json({ error: "Skills bridge item not found" }, { status: 404 });
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
