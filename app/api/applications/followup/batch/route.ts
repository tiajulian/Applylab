import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const appIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

  let query = supabase
    .from("application_followups")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (appIds.length > 0) {
    query = query.in("application_id", appIds);
  }

  const { data: followups, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ followups: followups ?? [] });
}
