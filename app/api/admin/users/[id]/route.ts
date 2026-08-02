import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const MAX_COST_ROWS = 500;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();

    const supabase = createServiceRoleClient();

    const [{ data: user, error: userError }, { data: resumes, error: resumesError }, { data: costRows, error: costError }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, email, full_name, plan, stripe_customer_id, resumes_used, is_admin, created_at")
          .eq("id", params.id)
          .single(),
        supabase
          .from("resumes")
          .select("id, job_title, company_name, assist_calls_used, content_score_count, created_at")
          .eq("user_id", params.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("api_cost_log")
          .select("feature, model, input_tokens, output_tokens, estimated_cost_usd, created_at")
          .eq("user_id", params.id)
          .order("created_at", { ascending: false })
          .limit(MAX_COST_ROWS),
      ]);

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (resumesError) {
      return NextResponse.json({ error: resumesError.message }, { status: 500 });
    }
    if (costError) {
      return NextResponse.json({ error: costError.message }, { status: 500 });
    }

    const costByFeature: Record<string, { calls: number; costUsd: number }> = {};
    let totalCostUsd = 0;
    for (const row of costRows ?? []) {
      const bucket = costByFeature[row.feature] ?? { calls: 0, costUsd: 0 };
      bucket.calls += 1;
      bucket.costUsd += row.estimated_cost_usd;
      costByFeature[row.feature] = bucket;
      totalCostUsd += row.estimated_cost_usd;
    }

    return NextResponse.json({
      user,
      resumes: resumes ?? [],
      usage: {
        totalCostUsd,
        costByFeature,
        recentCalls: (costRows ?? []).slice(0, 50),
        // MAX_COST_ROWS is a bound on the query, not a true total — flag when the real total
        // could be higher so the admin UI doesn't silently understate spend.
        truncated: (costRows ?? []).length >= MAX_COST_ROWS,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-user-detail error", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
