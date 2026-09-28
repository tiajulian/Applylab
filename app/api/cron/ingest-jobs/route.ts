import { NextResponse } from "next/server";
import { ingestJobs, isCronAuthorized, parseMaxCalls } from "@/lib/jobs/ingestion";

export const dynamic = "force-dynamic";
// Adzuna allows 25 calls/minute, so a 60-call run needs ~3 minutes of paced waiting.
export const maxDuration = 300;

// Daily Adzuna ingestion (vercel.json cron). Also used by scripts/ingest-jobs.mjs for manual
// runs: ?maxCalls=N overrides the run budget, ?dryRun=1 fetches one page and writes nothing.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const maxCalls = parseMaxCalls(params.get("maxCalls"));
  if (maxCalls === null) {
    return NextResponse.json({ error: "maxCalls must be an integer from 1 to 250" }, { status: 400 });
  }

  try {
    const result = await ingestJobs({ maxCalls, dryRun: params.get("dryRun") === "1" });
    return NextResponse.json(result, { status: result.status === "locked" ? 409 : 200 });
  } catch (error) {
    console.error("cron-ingest-jobs error", error);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
