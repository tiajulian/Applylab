import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

export async function GET() {
  try {
    const { authUserId, appUser } = await requireUser();
    const supabase = createClient();

    // RLS already scopes every one of these to the caller's own rows — the explicit
    // .eq("user_id", ...) filters below are belt-and-suspenders, consistent with the rest of
    // the app's routes. resume_versions has no user_id column; ownership there is enforced by
    // the join-based RLS policy on that table (see supabase/schema.sql), so no filter is needed.
    const [profileResult, resumesResult, applicationsResult, versionsResult] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("user_id", authUserId).maybeSingle(),
      supabase.from("resumes").select("*").eq("user_id", authUserId),
      supabase.from("applications").select("*").eq("user_id", authUserId),
      supabase.from("resume_versions").select("*"),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      account: {
        email: appUser.email,
        full_name: appUser.full_name,
        plan: appUser.plan,
        onboarded: appUser.onboarded,
        created_at: appUser.created_at,
      },
      profile: profileResult.data ?? null,
      resumes: resumesResult.data ?? [],
      resume_versions: versionsResult.data ?? [],
      applications: applicationsResult.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="applylab-data-export.json"',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("export-account error", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
