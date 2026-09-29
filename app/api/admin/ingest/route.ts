import { NextResponse } from "next/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import { ingestJobs, parseMaxCalls } from "@/lib/jobs/ingestion";

export const dynamic = "force-dynamic";
// Every Supabase RPC here must hit the database: Next.js would otherwise cache identical POSTs
// (e.g. adzuna_consume_call) and replay a stale call count, silently disabling the budget.
export const fetchCache = "force-no-store";
export const maxDuration = 300;

// Admin-only manual Adzuna ingestion. Body: { maxCalls?: number, dryRun?: boolean }.
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = (await request.json().catch(() => ({}))) as { maxCalls?: unknown; dryRun?: unknown };
    const maxCalls = parseMaxCalls(body.maxCalls);
    if (maxCalls === null) {
      return NextResponse.json({ error: "maxCalls must be an integer from 1 to 250" }, { status: 400 });
    }

    const result = await ingestJobs({ maxCalls, dryRun: body.dryRun === true });
    return NextResponse.json(result, { status: result.status === "locked" ? 409 : 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-ingest error", error);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
