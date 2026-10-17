import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

/** "Allow and continue" on the first-time microphone screen. Written once; never cleared here. */
export async function POST() {
  try {
    const { authUserId } = await requireUser();
    const { error } = await createServiceRoleClient()
      .from("users")
      .update({ mic_consent_at: new Date().toISOString() })
      .eq("id", authUserId)
      .is("mic_consent_at", null);
    if (error) {
      console.error("mic consent write failed", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("mic consent error", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
