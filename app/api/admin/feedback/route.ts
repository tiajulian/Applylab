import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();

    const { data: feedback, error } = await supabase
      .from("feedback")
      .select("id, user_id, type, message, page_url, status, created_at, users(email, full_name, plan)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback: feedback ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-list-feedback error", error);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }
}
