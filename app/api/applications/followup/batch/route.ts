import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const appIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

    let query = supabase
      .from("application_followups")
      .select("*")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false });

    if (appIds.length > 0) {
      query = query.in("application_id", appIds);
    }

    const { data: followups, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ followups: followups ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("get-batch-followups error", error);
    return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 });
  }
}
