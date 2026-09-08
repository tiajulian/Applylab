import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  FreeTierFeatureLimitReachedError,
  freeTierLimitReachedResponse,
  requireUser,
  reserveFreeTierFeature,
  trackFreeTierReservation,
  UnauthorizedError,
} from "@/lib/requireUser";
import { assistBullet, AssistBulletError } from "@/lib/anthropic/assistBullet";
import { EMPTY_COMPACT_JOB_AD } from "@/lib/anthropic/parseJobAd";
import { flagWinPolishDrift } from "@/lib/resume/factCheck";
import type { WorkExperienceWin } from "@/types";

// Uses cookies() (via requireUser) on every request, so it can never be statically rendered.
export const dynamic = "force-dynamic";

// Same soft-backstop shape as win-starters - polish is only ever triggered by an explicit click
// in the Win Builder's editor, never on keystroke or load.
const RATE_LIMIT_PER_HOUR = 20;
const MAX_TEXT_LENGTH = 500;

function stringField(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringListField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 20);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const reservation = trackFreeTierReservation("win-polish");

  try {
    const { authUserId, appUser } = await requireUser();
    const body = await request.json();

    // The win's own slots (not just its assembled text) - needed so flagWinPolishDrift below can
    // tell an allowed word (already in one of these) from a genuinely new one the rewrite added.
    const original: WorkExperienceWin = {
      text: stringField(body.text, MAX_TEXT_LENGTH),
      metric: stringField(body.metric, MAX_TEXT_LENGTH),
      verb: stringField(body.verb, MAX_TEXT_LENGTH) || undefined,
      what: stringField(body.what, MAX_TEXT_LENGTH) || undefined,
      outcome: stringField(body.outcome, MAX_TEXT_LENGTH) || undefined,
      tools: stringListField(body.tools),
      stakeholders: stringListField(body.stakeholders),
    };
    const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle : undefined;
    const roleCompany = typeof body.roleCompany === "string" ? body.roleCompany : undefined;

    if (!original.text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const serviceRoleSupabase = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceRoleSupabase
      .from("api_cost_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", "assist")
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Polish limit reached for now. Try again shortly, or edit the wording yourself." },
        { status: 429 }
      );
    }

    // Free-tier account-level cap (spec: "just like resume/assist limitation") - separate from
    // the hourly stopgap above, which only bounds a burst, not repeated use over days.
    await reserveFreeTierFeature(supabase, appUser, "win-polish");
    reservation.markReserved(authUserId);

    // Job-agnostic - a profile-level win has no target job (see the "polish" action in
    // lib/anthropic/assistBullet.ts). Role context is the win's own role, not a target one.
    // The request-scoped `createClient()` supabase (not the service-role one above) - the AI
    // gateway's reserve/commit RPCs authenticate the caller via auth.uid(), which only resolves
    // through the caller's own session, never the service-role client.
    const options = await assistBullet(
      {
        bulletText: original.text,
        action: "polish",
        roleTitle,
        roleCompany,
        jobTitle: "",
        companyName: "",
        compactJobAd: EMPTY_COMPACT_JOB_AD,
        isCurrentRole: Boolean(body.is_current),
      },
      authUserId,
      supabase,
      appUser.plan
    );

    const suggestion = options[0];
    if (!suggestion) {
      await reservation.refundIfReserved(supabase);
      return NextResponse.json({ error: "No suggestion came back. Try again, or edit the wording yourself." }, { status: 502 });
    }

    const actionFirst = suggestion;
    let metricFirst = options[1] || actionFirst;
    if (original.metric && !metricFirst.toLowerCase().includes(original.metric.toLowerCase())) {
      metricFirst = `${original.metric.charAt(0).toUpperCase() + original.metric.slice(1)}: ${actionFirst}`;
    }
    const concise = options[2] || (actionFirst.length > 80 ? actionFirst.slice(0, 75).trim() + "." : actionFirst);

    const variations = {
      actionFirst,
      metricFirst,
      concise,
    };

    return NextResponse.json({
      suggestion,
      variations,
      driftFlags: flagWinPolishDrift(original, suggestion),
    });
  } catch (error) {
    await reservation.refundIfReserved(supabase);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeTierFeatureLimitReachedError) {
      return freeTierLimitReachedResponse(error);
    }
    if (error instanceof AssistBulletError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("win-polish error", error);
    return NextResponse.json({ error: "Failed to polish wording" }, { status: 500 });
  }
}
