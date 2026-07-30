import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";

const MAX_RESULTS = 50;

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().slice(0, 200) ?? "";

    const supabase = createServiceRoleClient();
    let builder = supabase
      .from("users")
      .select("id, email, full_name, plan, resumes_used, is_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_RESULTS);

    if (query) {
      builder = builder.ilike("email", `%${query}%`);
    }

    const { data: users, error } = await builder;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-list-users error", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
