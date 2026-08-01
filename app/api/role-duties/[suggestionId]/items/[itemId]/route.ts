import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { RoleDutyItemUserState } from "@/types";

const ALLOWED_USER_STATES: RoleDutyItemUserState[] = ["confirmed", "rejected"];

export async function PATCH(
  request: Request,
  { params }: { params: { suggestionId: string; itemId: string } }
) {
  try {
    await requireUser();

    const body = await request.json();
    const { user_state: userState } = body ?? {};

    if (!ALLOWED_USER_STATES.includes(userState)) {
      return NextResponse.json(
        { error: "user_state must be 'confirmed' or 'rejected'" },
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
      .update({ user_state: userState })
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
