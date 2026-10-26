import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { replaceWordInProfile, type WordFixableProfile } from "@/lib/profile/replaceWord";

export const dynamic = "force-dynamic";

const MAX_WORD_LEN = 100;

/**
 * Applies a spelling fix the user just accepted in the resume editor to their Career Profile too
 * (body: { from, to }), so the next resume built from the profile doesn't repeat the typo. Only
 * the five text-bearing columns are read and written, never the whole profile.
 */
export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!from || !to || from === to || from.length > MAX_WORD_LEN || to.length > MAX_WORD_LEN || /\s/.test(from)) {
      return NextResponse.json({ error: "from and to must be two different single words" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: row, error: readError } = await supabase
      .from("user_profiles")
      .select("work_experience, projects, education, skills, tools")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!row) return NextResponse.json({ replaced: 0 });

    const { profile, replaced } = replaceWordInProfile(row as WordFixableProfile, from, to);
    if (replaced === 0) return NextResponse.json({ replaced: 0 });

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq("user_id", authUserId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ replaced });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("profile fix-word error", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
