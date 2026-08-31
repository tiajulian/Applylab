import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { FeedbackType } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const FEEDBACK_TYPES: FeedbackType[] = ["bug", "feature", "complaint", "other"];
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PAGE_URL_LENGTH = 500;

function isValidType(value: unknown): value is FeedbackType {
  return typeof value === "string" && (FEEDBACK_TYPES as string[]).includes(value);
}

// Not gated behind requirePermanentUser: feedback (especially bug reports) from an anonymous
// trial account is still useful signal, and low friction matters more here than for paid
// features - see the research discussion that led to this route.
export async function GET() {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: feedback, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback: feedback ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("list-feedback error", error);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser(request);
    const supabase = createClient();

    const body = await request.json().catch(() => ({}));

    const type = isValidType(body.type) ? body.type : null;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!type) {
      return NextResponse.json({ error: "type must be one of bug, feature, complaint, other" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const pageUrl =
      typeof body.page_url === "string" && body.page_url.trim()
        ? body.page_url.trim().slice(0, MAX_PAGE_URL_LENGTH)
        : null;

    const { data: feedback, error } = await supabase
      .from("feedback")
      .insert({
        user_id: authUserId,
        type,
        message: message.slice(0, MAX_MESSAGE_LENGTH),
        page_url: pageUrl,
      })
      .select()
      .single();

    if (error || !feedback) {
      return NextResponse.json({ error: error?.message ?? "Failed to submit feedback" }, { status: 500 });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("create-feedback error", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
