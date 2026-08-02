import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import type { Plan } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const VALID_PLANS: Plan[] = ["free", "pro", "lifetime"];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const plan = body.plan;

    if (typeof plan !== "string" || !VALID_PLANS.includes(plan as Plan)) {
      return NextResponse.json({ error: "plan must be 'free', 'pro', or 'lifetime'" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: user, error } = await supabase
      .from("users")
      .update({ plan })
      .eq("id", params.id)
      .select("id, email, plan")
      .single();

    if (error || !user) {
      return NextResponse.json({ error: error?.message ?? "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-comp-user error", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
