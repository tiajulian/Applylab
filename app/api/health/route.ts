import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** For uptime monitoring: 200 when the database answers, 503 when it doesn't. Reveals no details. */
export async function GET() {
  const started = Date.now();
  const { error } = await createServiceRoleClient().from("users").select("id").limit(1);
  if (error) console.error("health check: database unreachable", error);
  return NextResponse.json(
    { ok: !error, dbMs: Date.now() - started },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
